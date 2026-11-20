"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Wand2,
  Play,
  Check,
  RotateCcw,
  Trash2,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  GitBranch,
  FileCode2,
  ListChecks,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

import type {
  CodemodSpec,
  MigrationDTO,
  MigrationApplicationDTO,
  PreviewResponse,
  ChecklistItem,
} from "@/lib/types";
import { toggleChecklistItem } from "@/lib/checklist-builder";

/* -------------------------------------------------------------------------- */
/* API helpers                                                                */
/* -------------------------------------------------------------------------- */

async function http<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

interface Stats {
  migrations: number;
  applications: number;
  rolledBack: number;
}

/* -------------------------------------------------------------------------- */
/* Status chip                                                                */
/* -------------------------------------------------------------------------- */

function StatusChip({ status }: { status: string }) {
  if (status === "applied") {
    return (
      <Badge className="bg-emerald-600 text-white border-transparent">applied</Badge>
    );
  }
  if (status === "ready") {
    return (
      <Badge className="bg-amber-500 text-white border-transparent">ready</Badge>
    );
  }
  return <Badge variant="secondary">draft</Badge>;
}

/* -------------------------------------------------------------------------- */
/* Verification chip                                                          */
/* -------------------------------------------------------------------------- */

function VerificationBadge({
  status,
  reason,
}: {
  status: "passed" | "failed" | "skipped";
  reason?: string;
}) {
  if (status === "passed") {
    return (
      <span
        className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"
        title={reason}
      >
        <ShieldCheck className="size-4" />
        verification passed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300"
        title={reason}
      >
        <ShieldAlert className="size-4" />
        verification failed
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-muted-foreground"
      title={reason}
    >
      <ShieldOff className="size-4" />
      verification skipped
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Diff renderer                                                              */
/* -------------------------------------------------------------------------- */

function DiffView({ diff }: { diff: string }) {
  if (!diff || diff.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic px-3 py-6 text-center">
        No changes — the codemod did not transform this code.
      </div>
    );
  }
  const lines = diff.split("\n");
  return (
    <pre className="text-xs font-mono leading-relaxed overflow-x-auto thin-scroll">
      {lines.map((line, i) => {
        const cls =
          line.startsWith("+")
            ? "diff-add"
            : line.startsWith("-")
              ? "diff-del"
              : "diff-ctx";
        return (
          <div key={i} className={`px-3 py-0.5 whitespace-pre ${cls}`}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

/* -------------------------------------------------------------------------- */
/* Checklist                                                                  */
/* -------------------------------------------------------------------------- */

function Checklist({
  items,
  onToggle,
}: {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No manual steps generated.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2">
          <Checkbox
            id={item.id}
            checked={item.done}
            onCheckedChange={() => onToggle(item.id)}
            className="mt-0.5"
          />
          <label
            htmlFor={item.id}
            className={`text-sm leading-relaxed cursor-pointer ${
              item.done ? "line-through text-muted-foreground" : ""
            }`}
          >
            {item.text}
          </label>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Applications list                                                          */
/* -------------------------------------------------------------------------- */

function ApplicationRow({
  app,
  onRollback,
}: {
  app: MigrationApplicationDTO;
  onRollback: (appId: string) => Promise<void>;
}) {
  const [pending, setPending] = React.useState(false);
  const rolledBack = !!app.rolledBackAt;
  return (
    <li className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0 text-xs">
      <div className="min-w-0 flex-1">
        <div className="font-mono truncate text-foreground">{app.filePath}</div>
        <div className="text-muted-foreground">
          {app.matchCount} match{app.matchCount === 1 ? "" : "es"} ·{" "}
          {app.replacements} replacement{app.replacements === 1 ? "" : "s"}
          {app.verificationStatus ? ` · ${app.verificationStatus}` : ""}
        </div>
      </div>
      {rolledBack ? (
        <Badge variant="outline" className="text-muted-foreground">
          rolled back
        </Badge>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await onRollback(app.id);
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
          Rollback
        </Button>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* New migration dialog                                                       */
/* -------------------------------------------------------------------------- */

function NewMigrationDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (m: MigrationDTO) => void;
}) {
  const [description, setDescription] = useState("");
  const [sampleCode, setSampleCode] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const submit = useCallback(async () => {
    if (description.trim().length === 0) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const created = await http<MigrationDTO>("/api/migrations", {
        method: "POST",
        body: JSON.stringify({ description: description.trim(), sampleCode: sampleCode.trim() || undefined }),
      });
      toast({ title: "Migration created", description: created.name });
      onCreated(created);
      setDescription("");
      setSampleCode("");
      onClose();
    } catch (e) {
      toast({ title: "Failed to create migration", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }, [description, sampleCode, onClose, onCreated, toast]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>New migration</CardTitle>
          <CardDescription>
            Describe the migration you want the LLM to generate a codemod for.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="migration-desc">Migration description</Label>
            <Textarea
              id="migration-desc"
              placeholder="e.g. Convert CommonJS require() calls to ES module imports"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sample-code">Sample input code (optional)</Label>
            <Textarea
              id="sample-code"
              placeholder={`const fs = require('fs');\nmodule.exports = fs;`}
              value={sampleCode}
              onChange={(e) => setSampleCode(e.target.value)}
              className="min-h-32 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Providing sample code helps the LLM produce more accurate regex patterns.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              Generate codemod
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                  */
/* -------------------------------------------------------------------------- */

export default function Page() {
  const [migrations, setMigrations] = useState<MigrationDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ migrations: 0, applications: 0, rolledBack: 0 });
  const [newOpen, setNewOpen] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  const [code, setCode] = useState("");
  const [filePath, setFilePath] = useState("src/example.ts");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const { toast } = useToast();

  const selected = useMemo(
    () => migrations.find((m) => m.id === selectedId) ?? null,
    [migrations, selectedId],
  );

  /* ---- initial load ---- */
  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const [list, s] = await Promise.all([
        http<MigrationDTO[]>("/api/migrations"),
        http<Stats>("/api/stats"),
      ]);
      setMigrations(list);
      setStats(s);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (e) {
      toast({ title: "Failed to load migrations", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoadingList(false);
    }
  }, [selectedId, toast]);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- preview ---- */
  const handlePreview = useCallback(async () => {
    if (!selected) return;
    if (code.trim().length === 0) {
      toast({ title: "Paste some code first", variant: "destructive" });
      return;
    }
    setPreviewing(true);
    setPreview(null);
    try {
      const result = await http<PreviewResponse>(`/api/migrations/${selected.id}/preview`, {
        method: "POST",
        body: JSON.stringify({ code, filePath: filePath || undefined }),
      });
      setPreview(result);
    } catch (e) {
      toast({ title: "Preview failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  }, [selected, code, filePath, toast]);

  /* ---- apply ---- */
  const handleApply = useCallback(async () => {
    if (!selected || !preview) return;
    setApplying(true);
    try {
      await http(`/api/migrations/${selected.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ filePath: filePath || "src/example.ts", code }),
      });
      toast({ title: "Migration applied", description: `Persisted application for ${filePath}` });
      await loadList();
      // Re-preview to update verification chip with applied code
      await handlePreview();
    } catch (e) {
      toast({ title: "Apply failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  }, [selected, preview, filePath, code, toast, loadList, handlePreview]);

  /* ---- rollback ---- */
  const handleRollback = useCallback(
    async (appId: string) => {
      if (!selected) return;
      try {
        await http(`/api/migrations/${selected.id}/applications/${appId}/rollback`, {
          method: "POST",
        });
        toast({ title: "Application rolled back" });
        await loadList();
      } catch (e) {
        toast({ title: "Rollback failed", description: (e as Error).message, variant: "destructive" });
      }
    },
    [selected, toast, loadList],
  );

  /* ---- delete migration ---- */
  const handleDelete = useCallback(async () => {
    if (!selected) return;
    if (!confirm(`Delete migration "${selected.name}"? This also deletes its applications.`)) return;
    try {
      await http(`/api/migrations/${selected.id}`, { method: "DELETE" });
      toast({ title: "Migration deleted" });
      setSelectedId(null);
      setPreview(null);
      await loadList();
    } catch (e) {
      toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" });
    }
  }, [selected, toast, loadList]);

  /* ---- checklist toggle (local; persists to DB) ---- */
  const handleToggleChecklist = useCallback(
    async (id: string) => {
      if (!selected) return;
      // Optimistic update
      const next = toggleChecklistItem(selected.checklist, id);
      const prev = selected;
      setMigrations((ms) =>
        ms.map((m) => (m.id === selected.id ? { ...m, checklist: next } : m)),
      );
      try {
        await http(`/api/migrations/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify({ checklist: next }),
        });
      } catch (e) {
        // Rollback on failure
        setMigrations((ms) => ms.map((m) => (m.id === prev.id ? prev : m)));
        toast({ title: "Failed to save checklist", description: (e as Error).message, variant: "destructive" });
      }
    },
    [selected, toast],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ----- header ----- */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <GitBranch className="size-5" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold leading-tight">
                AI-Powered Code Migration Tool
              </h1>
              <p className="text-xs text-muted-foreground">
                Describe → generate codemod → apply → verify → rollback
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{stats.migrations} migrations</Badge>
              <Badge variant="outline">{stats.applications} applications</Badge>
              <Badge variant="outline">{stats.rolledBack} rolled back</Badge>
            </div>
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="size-4" />
              New migration
            </Button>
          </div>
        </div>
      </header>

      {/* ----- main ----- */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 p-4 md:p-6">
        {/* ----- left column ----- */}
        <aside className="lg:sticky lg:top-[72px] lg:self-start lg:max-h-[calc(100vh-88px)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Migrations
            </h2>
            {loadingList && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <ScrollArea className="flex-1 lg:max-h-[calc(100vh-140px)]">
            <ul className="space-y-1.5 pr-2">
              {migrations.length === 0 && !loadingList && (
                <li className="text-sm text-muted-foreground italic px-2 py-4">
                  No migrations yet. Click &ldquo;New migration&rdquo; to create one.
                </li>
              )}
              {migrations.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => {
                      setSelectedId(m.id);
                      setPreview(null);
                    }}
                    className={`w-full text-left p-3 rounded-md border transition-colors ${
                      m.id === selectedId
                        ? "bg-accent border-accent-foreground/20"
                        : "bg-card hover:bg-accent/50 border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{m.name}</span>
                      <StatusChip status={m.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {m.description}
                    </p>
                    <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <FileCode2 className="size-3" />
                      {m.applications.length} application{m.applications.length === 1 ? "" : "s"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </aside>

        {/* ----- center column ----- */}
        <section className="space-y-4 min-w-0">
          {!selected ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {loadingList
                  ? "Loading migrations…"
                  : "Select a migration on the left or create a new one to begin."}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ----- panel 1: migration detail ----- */}
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{selected.name}</CardTitle>
                    <CardDescription className="mt-1">{selected.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusChip status={selected.status} />
                    <Button size="sm" variant="outline" onClick={handleDelete}>
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Wand2 className="size-4 text-muted-foreground" />
                      Generated codemod spec
                    </div>
                    <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 overflow-x-auto thin-scroll max-h-72">
                      {JSON.stringify(selected.codemod, null, 2)}
                    </pre>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ListChecks className="size-4 text-muted-foreground" />
                      Manual checklist
                    </div>
                    <Checklist items={selected.checklist} onToggle={handleToggleChecklist} />
                  </div>
                </CardContent>
              </Card>

              {/* ----- panel 2: code input ----- */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">2. Paste code to transform</CardTitle>
                  <CardDescription>
                    The codemod is applied as a regex transform; patterns with a language filter only apply to matching file extensions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="file-path" className="text-xs">
                        File path (used for language filter)
                      </Label>
                      <Input
                        id="file-path"
                        value={filePath}
                        onChange={(e) => setFilePath(e.target.value)}
                        placeholder="src/example.ts"
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex md:items-end">
                      <Button onClick={handlePreview} disabled={previewing} className="w-full md:w-auto">
                        {previewing ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                        Preview transform
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={`Paste the code you want the codemod to transform.\n\nExample (CommonJS → ESM):\nconst fs = require('fs');\nmodule.exports = fs;`}
                    className="min-h-48 font-mono text-xs"
                  />
                </CardContent>
              </Card>

              {/* ----- panel 3: preview ----- */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">3. Preview &amp; verify</CardTitle>
                  <CardDescription>
                    Review the diff and verification status. Apply persists the transformation; Rollback reverts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!preview ? (
                    <div className="text-sm text-muted-foreground italic text-center py-8">
                      Click &ldquo;Preview transform&rdquo; to see the diff.
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <Badge variant="outline">
                          {preview.matchCount} match{preview.matchCount === 1 ? "" : "es"}
                        </Badge>
                        <Badge variant="outline">
                          {preview.replacements} replacement{preview.replacements === 1 ? "" : "s"}
                        </Badge>
                        <VerificationBadge
                          status={preview.verificationStatus}
                          reason={preview.verificationReason}
                        />
                      </div>
                      <div className="border rounded-md overflow-hidden bg-muted/30">
                        <div className="px-3 py-1.5 text-xs font-mono text-muted-foreground bg-muted/60 border-b">
                          unified diff · {filePath}
                        </div>
                        <DiffView diff={preview.diff} />
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <Button onClick={handleApply} disabled={applying || preview.replacements === 0}>
                          {applying ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          Apply (persist)
                        </Button>
                      </div>
                    </>
                  )}

                  {/* ----- applications history ----- */}
                  {selected.applications.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <FileCode2 className="size-4 text-muted-foreground" />
                          Application history ({selected.applications.length})
                        </div>
                        <ul>
                          {selected.applications
                            .slice()
                            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                            .map((app) => (
                              <ApplicationRow
                                key={app.id}
                                app={app}
                                onRollback={handleRollback}
                              />
                            ))}
                        </ul>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </section>
      </main>

      {/* ----- footer ----- */}
      <footer className="mt-auto border-t bg-card/40 px-4 md:px-6 py-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <span>
          MVP scope — regex-based transform. Real jscodeshift AST transforms and multi-file migrations are stretch goals.
        </span>
        <span>
          <span className="font-mono">{migrations.length}</span> migrations ·{" "}
          <span className="font-mono">{stats.applications}</span> applications ·{" "}
          <span className="font-mono">{stats.rolledBack}</span> rolled back
        </span>
      </footer>

      <NewMigrationDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={async (m) => {
          await loadList();
          setSelectedId(m.id);
        }}
      />
    </div>
  );
}
