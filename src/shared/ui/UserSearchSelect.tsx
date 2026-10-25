import { useEffect, useId, useRef, useState } from "react";
import { apiRequest } from "@/shared/lib/apiClient";
import { formatApiError } from "@/api/errors";
import type {
  DirectoryUser,
  DirectoryUsersQuery,
  DirectoryUsersResponse,
} from "@/api/contracts";

type UserSearchSelectProps = {
  label: string;
  value: string;
  onChange: (userId: string) => void;
  role?: NonNullable<DirectoryUsersQuery>["role"];
  departmentId?: string;
  disabled?: boolean;
  hint?: string;
  placeholder?: string;
};

export function UserSearchSelect({
  label,
  value,
  onChange,
  role,
  departmentId,
  disabled,
  hint,
  placeholder = "Search by name or email",
}: UserSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const listId = useId();
  const blurTimer = useRef<number | undefined>(undefined);

  // When the parent clears the value (e.g. after a successful submit), drop the
  // selected user so the search box returns.
  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "10" });
    if (debounced) params.set("q", debounced);
    if (role) params.set("role", role);
    if (departmentId) params.set("department_id", departmentId);
    void apiRequest<DirectoryUsersResponse>(`/users?${params.toString()}`)
      .then((response) => {
        if (active) setResults(response.items);
      })
      .catch((caught: unknown) => {
        if (active) {
          setResults([]);
          setError(formatApiError(caught));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debounced, open, role, departmentId]);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  function selectUser(user: DirectoryUser) {
    setSelected(user);
    onChange(user.id);
    setQuery("");
    setOpen(false);
  }

  function clearSelection() {
    setSelected(null);
    onChange("");
    setQuery("");
    setOpen(true);
  }

  return (
    <label className="field-label">
      {label}
      {selected ? (
        <span className="user-search-chip">
          <span>
            <b>{selected.display_name}</b>
            <span>{selected.email}</span>
          </span>
          <button
            type="button"
            className="text-button"
            onClick={clearSelection}
            disabled={disabled}
          >
            Change
          </button>
        </span>
      ) : (
        <div className="user-search">
          <input
            className="field-control"
            type="text"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => setOpen(false), 150);
            }}
          />
          {open && (
            <ul className="user-search-results" id={listId} role="listbox">
              {loading && (
                <li className="user-search-status" role="status">
                  Searching…
                </li>
              )}
              {!loading && error && (
                <li className="user-search-status">{error}</li>
              )}
              {!loading && !error && results.length === 0 && (
                <li className="user-search-status">No matching users.</li>
              )}
              {!loading &&
                !error &&
                results.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="user-search-option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectUser(user)}
                    >
                      <b>{user.display_name}</b>
                      <span>{user.email}</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
