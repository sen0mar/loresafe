import { useCallback, useLayoutEffect, useRef, useState } from "react";

const desktopSidebarPreferenceKey = "loresafe.desktop-sidebar";

const readDesktopSidebarPreference = () => {
  try {
    return (
      window.localStorage.getItem(desktopSidebarPreferenceKey) !== "closed"
    );
  } catch {
    return true;
  }
};

export const useDesktopSidebar = () => {
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(
    readDesktopSidebarPreference
  );
  const shouldRestoreFocusRef = useRef(false);
  const showSidebarButtonRef = useRef<HTMLButtonElement>(null);

  const updateDesktopSidebar = useCallback((isOpen: boolean) => {
    setIsDesktopSidebarOpen(isOpen);

    try {
      window.localStorage.setItem(
        desktopSidebarPreferenceKey,
        isOpen ? "open" : "closed"
      );
    } catch {
      // The in-memory preference still works when browser storage is unavailable.
    }
  }, []);

  const closeDesktopSidebar = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    shouldRestoreFocusRef.current = true;
    updateDesktopSidebar(false);
  }, [updateDesktopSidebar]);

  useLayoutEffect(() => {
    if (isDesktopSidebarOpen || !shouldRestoreFocusRef.current) {
      return;
    }

    showSidebarButtonRef.current?.focus();
    shouldRestoreFocusRef.current = false;
  }, [isDesktopSidebarOpen]);

  return {
    closeDesktopSidebar,
    isDesktopSidebarOpen,
    openDesktopSidebar: () => updateDesktopSidebar(true),
    showSidebarButtonRef
  };
};
