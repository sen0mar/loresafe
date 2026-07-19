import { useCallback, useState } from "react";

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

  return {
    closeDesktopSidebar: () => updateDesktopSidebar(false),
    isDesktopSidebarOpen,
    openDesktopSidebar: () => updateDesktopSidebar(true)
  };
};
