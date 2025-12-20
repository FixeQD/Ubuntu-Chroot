import { computed, readonly, ref, onMounted, onUnmounted } from "vue";

type ExecMethod = "ksu" | "sulib" | "none";

export type CommandResult = {
  success: boolean;
  exitCode?: number;
  output?: string;
  error?: string;
};

export type AsyncCallbacks = {
  onOutput?: (line: string) => void;
  onError?: (err: string) => void;
  onComplete?: (res: CommandResult) => void;
  onRawOutput?: (raw: string) => void;
};

export function useNativeCmd() {
  const LOGGING_PREFIX = "LOGGING_ENABLED=1";

  // reactive state for whether the native bridge is available
  const _available = ref<boolean>(
    typeof window !== "undefined" &&
      !!(window as any).cmdExec &&
      (typeof (window as any).cmdExec.execute === "function" ||
        typeof (window as any).cmdExec.executeAsync === "function"),
  );

  const isAvailable = computed(() => {
    return (
      typeof window !== "undefined" &&
      !!(window as any).cmdExec &&
      (typeof (window as any).cmdExec.execute === "function" ||
        typeof (window as any).cmdExec.executeAsync === "function") &&
      execMethod.value !== "none"
    );
  });

  onMounted(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 40; // ~10s polling window
    const INTERVAL_MS = 250;
    const interval = setInterval(() => {
      attempts++;
      const bridge = (window as any).cmdExec;
      const execMethodCheck = bridge
        ? (bridge.execMethod as ExecMethod) || "none"
        : "none";
      const ok =
        typeof window !== "undefined" &&
        !!bridge &&
        (typeof bridge.execute === "function" ||
          typeof bridge.executeAsync === "function") &&
        execMethodCheck !== "none";
      _available.value = ok;
      if (ok || attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
      }
    }, INTERVAL_MS);

    onUnmounted(() => clearInterval(interval));
  });

  const execMethod = computed<ExecMethod>(() => {
    try {
      const bridge = (window as any).cmdExec;
      if (!bridge) return "none";
      return (bridge.execMethod as ExecMethod) || "none";
    } catch {
      return "none";
    }
  });

  function normalizeOutput(raw: string): string[] {
    if (!raw) return [];
    return String(raw)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("[Executing:"));
  }

  function runCommandAsync(
    command: string,
    options?: { asRoot?: boolean; debug?: boolean; callbacks?: AsyncCallbacks },
  ): string | null {
    const bridge = (window as any).cmdExec;
    if (!bridge || typeof bridge.executeAsync !== "function") return null;

    const asRoot = options?.asRoot !== undefined ? options.asRoot : true;
    const enableDebug = !!options?.debug;
    const callbacks = options?.callbacks || {};

    const finalCommand = enableDebug ? `${LOGGING_PREFIX} ${command}` : command;

    try {
      const commandId = bridge.executeAsync(finalCommand, asRoot, {
        onOutput: (out: string) => {
          if (callbacks.onRawOutput) callbacks.onRawOutput(out);
          const lines = normalizeOutput(out);
          lines.forEach((line) => {
            if (callbacks.onOutput) callbacks.onOutput(line);
          });
        },
        onError: (err: any) => {
          if (callbacks.onError) callbacks.onError(String(err));
        },
        onComplete: (res: CommandResult) => {
          if (callbacks.onComplete) callbacks.onComplete(res);
        },
      });
      return commandId;
    } catch {
      return null;
    }
  }

  function runCommandAsyncPromise(
    command: string,
    options?: {
      asRoot?: boolean;
      debug?: boolean;
      onOutput?: (line: string) => void;
      timeoutMs?: number;
    },
  ): Promise<CommandResult> {
    const timeoutMs = options?.timeoutMs;

    return new Promise((resolve) => {
      const callbacks: AsyncCallbacks = {
        onOutput: (line) => options?.onOutput?.(line),
        onError: (err) => resolve({ success: false, error: String(err) }),
        onComplete: (result) => resolve(result),
      };

      if (!isAvailable.value) {
        resolve({ success: false, error: "No command bridge available" });
        return;
      }

      const commandId = runCommandAsync(command, {
        asRoot: options?.asRoot,
        debug: options?.debug,
        callbacks,
      });

      if (!commandId) {
        resolve({ success: false, error: "Failed to start command" });
        return;
      }

      // Set timeout to prevent hanging, if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (timeoutMs && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          resolve({ success: false, error: "Command execution timed out" });
        }, timeoutMs);
      }

      // Clear timeout when command completes
      const originalOnComplete = callbacks.onComplete;
      const originalOnError = callbacks.onError;
      callbacks.onComplete = (result) => {
        if (timeoutId) clearTimeout(timeoutId);
        originalOnComplete?.(result);
      };
      callbacks.onError = (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        originalOnError?.(err);
      };
    });
  }

  async function runCommandSync(
    command: string,
    options?: { asRoot?: boolean; debug?: boolean },
  ): Promise<string> {
    const bridge = (window as any).cmdExec;
    if (!bridge || typeof bridge.execute !== "function") {
      return "";
    }

    const asRoot = options?.asRoot !== undefined ? options.asRoot : true;
    const enableDebug = !!options?.debug;
    const finalCommand = enableDebug ? `${LOGGING_PREFIX} ${command}` : command;

    try {
      const out = await bridge.execute(finalCommand, asRoot);
      return String(out || "");
    } catch (err) {
      throw err;
    }
  }

  function getRunningCommands(): Array<{
    id: string;
    command: string;
    startTime: number;
    duration: number;
  }> {
    try {
      const bridge = (window as any).cmdExec;
      if (!bridge || typeof bridge.getRunningCommands !== "function") return [];
      return bridge.getRunningCommands() || [];
    } catch {
      return [];
    }
  }

  function isCommandRunning(commandId: string): boolean {
    try {
      const bridge = (window as any).cmdExec;
      if (!bridge || typeof bridge.isCommandRunning !== "function")
        return false;
      return bridge.isCommandRunning(commandId);
    } catch {
      return false;
    }
  }

  async function captureCommandOutput(
    command: string,
    options?: { asRoot?: boolean; debug?: boolean },
  ): Promise<{ result: CommandResult; lines: string[] }> {
    const lines: string[] = [];
    const res = await runCommandAsyncPromise(command, {
      asRoot: options?.asRoot,
      debug: options?.debug,
      onOutput: (line) => lines.push(line),
    });
    return { result: res, lines };
  }

  // Keep reactive availability in sync with dynamic computed
  _available.value = isAvailable.value;

  return {
    isAvailable: readonly(_available),
    execMethod,
    runCommandAsync,
    runCommandAsyncPromise,
    runCommandSync,
    captureCommandOutput,
    getRunningCommands,
    isCommandRunning,
  };
}

export default useNativeCmd;
