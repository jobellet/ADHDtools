// Simple active user manager shared across tools
(function() {
  const STORAGE_KEY = 'adhd-active-user';
  const USERS_KEY = 'adhd-known-users';

  function readActiveUser() {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch (err) {
      console.warn('Failed to read active user', err);
      return null;
    }
  }

  function writeActiveUser(user) {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, user);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn('Failed to persist active user', err);
    }
  }

  function readKnownUsers() {
    try {
      const raw = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.warn('Failed to read known users', err);
      return [];
    }
  }

  function writeKnownUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (err) {
      console.warn('Failed to persist known users', err);
    }
  }

  function mergeKnownUsers(users) {
    const existing = readKnownUsers();
    const merged = Array.from(new Set([...existing, ...users].filter(Boolean)));
    writeKnownUsers(merged);
    return merged;
  }

  function getDefaultUser() {
    return window.TaskModel?.DEFAULT_USER || 'main';
  }

  function getActiveUser() {
    return readActiveUser() || getDefaultUser();
  }

  function setActiveUser(user) {
    const normalized = (user || '').trim();
    const next = normalized || getDefaultUser();
    writeActiveUser(next);
    mergeKnownUsers([next]);
    window.dispatchEvent(new CustomEvent('activeUserChanged', { detail: next }));
    return next;
  }

  function ensureUsersFromTasks(tasks = []) {
    const users = tasks.map(t => t.user).filter(Boolean);
    if (users.length) mergeKnownUsers(users);
  }

  const UserContext = { getActiveUser, setActiveUser, getKnownUsers: readKnownUsers, ensureUsersFromTasks };

  if (typeof window !== 'undefined') {
    window.UserContext = UserContext;
  }

  // Hydrate known users at load time from TaskStore if available
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const tasks = window.TaskStore?.getAllTasks?.();
      if (tasks) ensureUsersFromTasks(tasks);
      const active = readActiveUser();
      if (!active && tasks?.length) {
        const firstUser = tasks[0].user || getDefaultUser();
        setActiveUser(firstUser);
      }
    } catch (err) {
      console.warn('UserContext init failed', err);
    }
  });
})();
