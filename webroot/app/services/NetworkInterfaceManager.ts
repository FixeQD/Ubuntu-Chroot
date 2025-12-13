export class NetworkInterfaceManager {
  constructor(
    private deps: {
      Storage: {
        getJSON?: <T = any>(key: string, defaultValue?: T | null) => T | null;
        setJSON?: (key: string, value: any) => void;
        get: (key: string, defaultValue?: any) => any;
        set: (key: string, value: any) => void;
      };
      appendConsole?: (text: string, cls?: string) => void;
      runCmdSync: (cmd: string) => Promise<string>;
      rootAccessConfirmed?: { value: boolean };
    },
    private scriptPath: string,
    private cacheKey: string,
    private selectElement?: HTMLSelectElement | null,
    private selectedInterfaceKey?: string,
    private onInterfacesUpdated?: (interfaces: string[]) => void,
  ) {}

  /**
   * Update the select element reference (useful when DOM elements are created after initialization)
   */
  updateSelectElement(selectElement: HTMLSelectElement | null) {
    this.selectElement = selectElement;
  }

  /**
   * Set callback for when interfaces are updated
   */
  setOnInterfacesUpdated(callback: (interfaces: string[]) => void) {
    this.onInterfacesUpdated = callback;
  }

  /**
   * Populate the interface select UI with a list of interface strings.
   * The `interfacesRaw` array contains elements like: "wlan0:10.0.0.1" or "eth0".
   */
  populateInterfaces(interfacesRaw: string[]) {
    const select = this.selectElement;
    if (!select) return;

    select.innerHTML = "";
    if (!interfacesRaw || interfacesRaw.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No interfaces found";
      select.appendChild(option);
      select.disabled = true;
      try {
        if (this.selectedInterfaceKey) {
          this.deps.Storage.set(this.selectedInterfaceKey, "");
        }
      } catch {
        // ignore
      }
      return;
    }

    interfacesRaw.forEach((ifaceRaw) => {
      const trimmed = String(ifaceRaw || "").trim();
      if (!trimmed) return;

      const option = document.createElement("option");
      if (trimmed.includes(":")) {
        const [iface, ip] = trimmed.split(":").map((s) => s.trim());
        option.value = iface;
        option.textContent = `${iface} (${ip})`;
      } else {
        option.value = trimmed;
        option.textContent = trimmed;
      }
      select.appendChild(option);
    });

    select.disabled = false;
    try {
      if (this.selectedInterfaceKey) {
        const saved = this.deps.Storage.get(this.selectedInterfaceKey);
        if (saved) {
          const opt = Array.from(select.options).find((o) => o.value === saved);
          if (opt) {
            select.value = String(saved);
          } else {
            select.value = "";
          }
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Fetch network interfaces. Uses caching (Storage) and prefers cached data unless forced.
   * - forceRefresh: forces fetching from script and updating cache.
   * - backgroundOnly: when true, only updates cache but does not update UI elements.
   */
  async fetchInterfaces(forceRefresh = false, backgroundOnly = false) {
    const cached: string[] =
      (this.deps.Storage.getJSON
        ? this.deps.Storage.getJSON(this.cacheKey)
        : null) || [];

    if (cached && Array.isArray(cached) && cached.length > 0 && !forceRefresh) {
      if (!backgroundOnly) {
        this.populateInterfaces(cached);
        this.onInterfacesUpdated?.(cached);
      }
      return;
    }

    // No cache or forced refresh
    try {
      const cmd = `sh ${this.scriptPath} list-iface 2>&1`;
      const out = await this.deps.runCmdSync(cmd);
      const text = String(out || "").trim();

      const interfacesRaw = text
        ? text
            .split(/[\r\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      try {
        this.deps.Storage.setJSON?.(this.cacheKey, interfacesRaw);
      } catch {
        // ignore
      }

      if (!backgroundOnly) {
        this.populateInterfaces(interfacesRaw);
        this.onInterfacesUpdated?.(interfacesRaw);
      }
    } catch (err: any) {
      // Show a polite warning in console unless backgroundOnly
      if (!backgroundOnly) {
        this.deps.appendConsole?.(
          `Could not fetch interfaces: ${String(err?.message || err)}`,
          "warn",
        );
        const select = this.selectElement;
        if (select) {
          select.innerHTML = "";
          const option = document.createElement("option");
          option.value = "";
          option.textContent = "Failed to load interfaces";
          select.appendChild(option);
          select.disabled = true;
        }
      }
    }
  }
}
