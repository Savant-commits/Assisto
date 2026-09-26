"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import SendWarningDialog from "./send-warning-dialog";

export default function AdminSendWarning() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);

  async function handleSearchChange(query: string) {
    setSearch(query);
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const q = query.toLowerCase();
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,user_code")
        .or(`full_name.ilike.%${q}%,user_code.ilike.%${q}%`)
        .limit(10);

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Search failed:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectUser(user: any) {
    setSelectedUser(user);
    setSearchOpen(false);
    setShowWarningDialog(true);
  }

  if (!searchOpen && !showWarningDialog) {
    return (
      <button
        className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm text-white"
        onClick={() => setSearchOpen(true)}
      >
        Search and send warning
      </button>
    );
  }

  return (
    <>
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Search User</h2>

            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or user code..."
              className="w-full rounded border bg-background px-3 py-2"
              autoFocus
            />

            {loading && <p className="mt-2 text-sm text-muted-foreground">Searching...</p>}

            {search.trim() && !loading && users.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">No users found</p>
            )}

            {users.length > 0 && (
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className="w-full rounded border p-2 text-left hover:bg-muted"
                  >
                    <div className="font-medium">{user.full_name}</div>
                    <div className="text-xs text-muted-foreground">{user.user_code}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                className="rounded border px-4 py-2 text-sm"
                onClick={() => {
                  setSearchOpen(false);
                  setSearch("");
                  setUsers([]);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <SendWarningDialog
          isOpen={showWarningDialog}
          recipientId={selectedUser.id}
          onClose={() => {
            setShowWarningDialog(false);
            setSearchOpen(false);
            setSearch("");
            setUsers([]);
            setSelectedUser(null);
          }}
          onSuccess={(emailSent) => {
            alert(
              emailSent
                ? "Warning sent"
                : "Warning sent (email delivery failed, notified in-app only)"
            );
            setShowWarningDialog(false);
            setSearchOpen(false);
            setSearch("");
            setUsers([]);
            setSelectedUser(null);
          }}
        />
      )}
    </>
  );
}
