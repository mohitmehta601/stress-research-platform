import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Outlet, useNavigate } from "react-router";
import {
  AlertCircle,
  Bell,
  CheckCheck,
  LoaderCircle,          
  LogOut,                   
  RefreshCw,
  Search,
} from "lucide-react";

import { Sidebar } from "./Sidebar";
import {
  clearToken,
  getNotifications,
  markNotificationRead,
} from "../services/apiClient";
import type { DashboardNotification } from "../types";

interface TopbarProps {
  user?: {
    name: string;
    role: string;
  };
}

function sortNotifications(
  items: DashboardNotification[],
): DashboardNotification[] {
  return [...items].sort((first, second) => {
    const firstTime = first.createdAt
      ? new Date(first.createdAt).getTime()
      : 0;

    const secondTime = second.createdAt
      ? new Date(second.createdAt).getTime()
      : 0;

    return secondTime - firstTime;
  });
}

function Topbar({ user }: TopbarProps) {
  const navigate = useNavigate();

  const notificationContainerRef =
    useRef<HTMLDivElement | null>(null);

  const mountedRef = useRef(true);

  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [notifications, setNotifications] = useState<
    DashboardNotification[]
  >([]);

  const [notificationsLoading, setNotificationsLoading] =
    useState(true);

  const [notificationsRefreshing, setNotificationsRefreshing] =
    useState(false);

  const [markingAllRead, setMarkingAllRead] = useState(false);

  const [notificationError, setNotificationError] =
    useState("");

  const loadNotifications = useCallback(
    async (
      showInitialLoading = false,
      showRefreshLoading = false,
    ) => {
      if (showInitialLoading) {
        setNotificationsLoading(true);
      }

      if (showRefreshLoading) {
        setNotificationsRefreshing(true);
      }

      try {
        setNotificationError("");

        const items = await getNotifications();

        console.log("Notifications API response:", items);

        if (mountedRef.current) {
          setNotifications(
            sortNotifications(
              Array.isArray(items) ? items : [],
            ),
          );
        }
      } catch (error) {
        console.error(
          "Failed to load notifications:",
          error,
        );

        if (mountedRef.current) {
          setNotificationError(
            error instanceof Error
              ? error.message
              : "Could not load notifications.",
          );
        }
      } finally {
        if (mountedRef.current) {
          setNotificationsLoading(false);
          setNotificationsRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    void loadNotifications(true);

    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 15_000);

    const handleNotificationsUpdated = () => {
      console.log(
        "srp-notifications-updated event received",
      );

      void loadNotifications();
    };

    window.addEventListener(
      "srp-notifications-updated",
      handleNotificationsUpdated,
    );

    return () => {
      mountedRef.current = false;

      window.clearInterval(timer);

      window.removeEventListener(
        "srp-notifications-updated",
        handleNotificationsUpdated,
      );
    };
  }, [loadNotifications]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        notificationContainerRef.current &&
        !notificationContainerRef.current.contains(
          event.target as Node,
        )
      ) {
        setNotificationsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );

      document.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, []);

  const unreadNotifications = notifications.filter(
    (notification) => !notification.read,
  );

  const notificationCount = unreadNotifications.length;

  function handleLogout() {
    clearToken();

    navigate("/researcher/login", {
      replace: true,
    });
  }

  function handleNotificationToggle() {
    const nextOpenState = !notificationsOpen;

    setNotificationsOpen(nextOpenState);

    if (nextOpenState) {
      void loadNotifications(false, true);
    }
  }

  function formatWhen(value: string | null) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function navigateForNotification(
    notification: DashboardNotification,
  ) {
    const notificationType = (
      notification.type ?? ""
    ).toLowerCase();

    if (notificationType.includes("participant")) {
      navigate("/researcher/participants");
      return;
    }

    if (
      notificationType.includes("doctor") ||
      notificationType.includes("assessment")
    ) {
      navigate("/researcher/doctor");
      return;
    }

    if (
      notificationType.includes("questionnaire")
    ) {
      navigate("/researcher/questionnaires");
      return;
    }

    if (
      notificationType.includes("physiological") ||
      notificationType.includes("device") ||
      notificationType.includes("sensor")
    ) {
      navigate("/researcher/physiological");
      return;
    }

    if (notificationType.includes("export")) {
      navigate("/researcher/export");
      return;
    }

    if (notificationType.includes("access")) {
      navigate("/researcher/settings");
      return;
    }

    navigate("/researcher/sessions");
  }

  async function openNotification(
    notification: DashboardNotification,
  ) {
    if (!notification.read) {
      try {
        await markNotificationRead(notification.id);

        setNotifications((currentNotifications) =>
          currentNotifications.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  read: true,
                }
              : item,
          ),
        );
      } catch (error) {
        console.error(
          "Could not mark notification as read:",
          error,
        );

        setNotificationError(
          "Notification opened, but it could not be marked as read.",
        );
      }
    }

    setNotificationsOpen(false);
    navigateForNotification(notification);
  }

  async function markAllNotificationsRead() {
    if (
      unreadNotifications.length === 0 ||
      markingAllRead
    ) {
      return;
    }

    setMarkingAllRead(true);
    setNotificationError("");

    try {
      const results = await Promise.allSettled(
        unreadNotifications.map((notification) =>
          markNotificationRead(notification.id),
        ),
      );

      const successfullyUpdatedIds = new Set(
        unreadNotifications
          .filter(
            (_, index) =>
              results[index].status === "fulfilled",
          )
          .map((notification) => notification.id),
      );

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          successfullyUpdatedIds.has(notification.id)
            ? {
                ...notification,
                read: true,
              }
            : notification,
        ),
      );

      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedCount > 0) {
        setNotificationError(
          `${failedCount} notification(s) could not be marked as read.`,
        );
      }
    } catch (error) {
      console.error(
        "Could not mark all notifications as read:",
        error,
      );

      setNotificationError(
        "Could not mark notifications as read.",
      );
    } finally {
      setMarkingAllRead(false);
    }
  }

  function handleSearchSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedQuery = query
      .trim()
      .toLowerCase();

    if (!normalizedQuery) return;

    if (
      normalizedQuery.includes("participant")
    ) {
      navigate("/researcher/participants");
    } else if (
      normalizedQuery.includes("questionnaire")
    ) {
      navigate("/researcher/questionnaires");
    } else if (
      normalizedQuery.includes("doctor") ||
      normalizedQuery.includes("assessment")
    ) {
      navigate("/researcher/doctor");
    } else if (
      normalizedQuery.includes("sensor") ||
      normalizedQuery.includes("physiological")
    ) {
      navigate("/researcher/physiological");
    } else if (
      normalizedQuery.includes("export")
    ) {
      navigate("/researcher/export");
    } else {
      navigate("/researcher/sessions");
    }

    setQuery("");
  }

  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-4 border-b border-border bg-card px-5">
      <div className="max-w-xs flex-1">
        <form
          onSubmit={handleSearchSubmit}
          className="relative"
        >
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />

          <input
            className="w-full rounded border border-border bg-muted py-1.5 pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-blue-400"
            placeholder="Search participants, sessions..."
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
          />
        </form>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div
          ref={notificationContainerRef}
          className="relative"
        >
          <button
            type="button"
            onClick={handleNotificationToggle}
            className={`relative rounded p-1.5 transition-colors hover:bg-muted ${
              notificationsOpen ? "bg-muted" : ""
            }`}
            title="Notifications"
            aria-label={`Notifications, ${notificationCount} unread`}
            aria-expanded={notificationsOpen}
          >
            <Bell
              size={15}
              className={
                notificationCount > 0
                  ? "text-blue-600"
                  : "text-muted-foreground"
              }
            />

            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
                {notificationCount > 99
                  ? "99+"
                  : notificationCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-9 z-30 w-[360px] overflow-hidden rounded border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Notifications
                  </div>

                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {notificationCount} unread{" "}
                    {notificationCount === 1
                      ? "item"
                      : "items"}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {notificationCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void markAllNotificationsRead()
                      }
                      disabled={markingAllRead}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                      title="Mark all as read"
                    >
                      {markingAllRead ? (
                        <LoaderCircle
                          size={13}
                          className="animate-spin"
                        />
                      ) : (
                        <CheckCheck size={13} />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      void loadNotifications(
                        false,
                        true,
                      )
                    }
                    disabled={notificationsRefreshing}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    title="Refresh notifications"
                  >
                    <RefreshCw
                      size={13}
                      className={
                        notificationsRefreshing
                          ? "animate-spin"
                          : ""
                      }
                    />
                  </button>
                </div>
              </div>

              {notificationError && (
                <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700">
                  <AlertCircle
                    size={13}
                    className="mt-0.5 flex-shrink-0"
                  />

                  <div className="flex-1">
                    {notificationError}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setNotificationError("")
                    }
                    className="font-semibold"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="max-h-80 overflow-y-auto">
                {notificationsLoading ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-8 text-xs text-muted-foreground">
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />

                    Loading notifications…
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <Bell
                      size={19}
                      className="mx-auto text-muted-foreground"
                    />

                    <div className="mt-2 text-xs font-medium text-foreground">
                      No notifications
                    </div>

                    <div className="mt-1 text-[10px] text-muted-foreground">
                      New research alerts will appear
                      here.
                    </div>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() =>
                        void openNotification(
                          notification,
                        )
                      }
                      className={`relative block w-full border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60 ${
                        notification.read
                          ? "bg-card"
                          : "bg-blue-50/70"
                      }`}
                    >
                      {!notification.read && (
                        <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-blue-500" />
                      )}

                      <div className="pr-4 text-xs font-semibold text-foreground">
                        {notification.title}
                      </div>

                      <div className="mt-1 pr-4 text-[11px] leading-relaxed text-muted-foreground">
                        {notification.message}
                      </div>

                      {formatWhen(
                        notification.createdAt,
                      ) && (
                        <div className="mt-1.5 text-[9px] text-muted-foreground">
                          {formatWhen(
                            notification.createdAt,
                          )}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="border-t border-border bg-muted/20 px-3 py-2 text-center text-[9px] text-muted-foreground">
                  Notifications refresh automatically
                  every 15 seconds
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 rounded px-2 py-1">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#1a3461] text-[10px] font-semibold text-white">
            {user?.name?.charAt(0).toUpperCase() ??
              "R"}
          </div>

          <div className="hidden sm:block">
            <div className="text-xs font-medium leading-tight text-foreground">
              {user?.name ?? "Researcher"}
            </div>

            <div className="text-[10px] leading-tight text-muted-foreground">
              {user?.role ?? "Researcher"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          title="Logout"
        >
          <LogOut size={13} />
          Logout
        </button>
      </div>
    </header>
  );
}

export function DashboardLayout({ user }: TopbarProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div className="ml-60 flex min-h-screen flex-col">
        <Topbar user={user} />

        <main className="flex-1 overflow-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
