"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserBaseStore } from "@/lib/userBaseStore";
import type {
  CoverLetterDocumentResponse,
  CoverLetterSuggestResponse,
  CoverLetterVersion,
} from "../type";

type CoverLetterEditorProps = {
  sessionId: string | null;
  jobId: string;
  jobTitle?: string | null;
  companyName?: string | null;
};

const DEFAULT_PLACEHOLDER =
  "Start your cover letter here. We'll keep a saved draft for this job.";

function ExternalContentPlugin({
  content,
  syncKey,
}: {
  content: string;
  syncKey: number;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      if (content.trim()) {
        paragraph.append($createTextNode(content));
      }
      root.append(paragraph);
    });
  }, [content, editor, syncKey]);

  return null;
}

export default function CoverLetterEditor({
  sessionId,
  jobId,
  jobTitle,
  companyName,
}: CoverLetterEditorProps) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftHash, setDraftHash] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [externalContent, setExternalContent] = useState("");
  const [externalSyncKey, setExternalSyncKey] = useState(0);
  const [autoSaved, setAutoSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("suggestion");
  const [versions, setVersions] = useState<CoverLetterVersion[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<CoverLetterSuggestResponse | null>(
    null
  );
  const [viewingPreview, setViewingPreview] = useState(false);
  const lastSavedRef = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDocument = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBase}/api/editor/document?session_id=${sessionId}&job_id=${jobId}`
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to load cover letter draft.");
      }
      const data = (await response.json()) as CoverLetterDocumentResponse;
      setDraftHash(data.draft_hash);
      setContent(data.draft_content ?? "");
      setExternalContent(data.draft_content ?? "");
      setExternalSyncKey((prev) => prev + 1);
      setVersions(data.versions ?? []);
      lastSavedRef.current = data.draft_content ?? "";
      setAutoSaved(false);
      setEditorKey((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    loadDocument();
  }, [sessionId, jobId]);

  useEffect(() => {
    if (!sessionId) return;
    if (viewingPreview) return;
    if (content === lastSavedRef.current) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const response = await fetch(`${apiBase}/api/editor/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            job_id: jobId,
            content,
            base_hash: draftHash,
          }),
        });
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Failed to save draft.");
        }
        const data = (await response.json()) as { draft_hash: string };
        setDraftHash(data.draft_hash);
        lastSavedRef.current = content;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Draft save failed.");
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [content, sessionId, apiBase, jobId, draftHash, viewingPreview]);

  useEffect(() => {
    if (!sessionId) return;
    if (!content.trim()) return;
    if (versions.length > 0) return;
    if (autoSaved) return;
    handleSaveVersion("autosave", content);
    setAutoSaved(true);
  }, [autoSaved, content, sessionId, versions.length]);

  const disableAllButtons = saving || savingVersion || suggesting;

  const initialConfig = useMemo(
    () => ({
      namespace: "cover-letter-editor",
      onError: (err: Error) => {
        console.error(err);
      },
    }),
    [editorKey]
  );

  const handleSuggest = async (intent: string) => {
    if (!sessionId) {
      setError("Upload a resume first to start a cover letter draft.");
      return;
    }
    setActiveTab("suggestion");
    setSuggesting(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/editor/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          job_id: jobId,
          content,
          intent,
          base_hash: draftHash,
        }),
      });
      if (response.status === 402) {
        const data = (await response.json().catch(() => ({}))) as {
          detail?: { required?: number; available?: number };
          required?: number;
          available?: number;
        };
        const detail = data.detail ?? data;
        const { useCheckoutModalStore } = await import(
          "@/lib/checkoutModalStore"
        );
        useCheckoutModalStore.getState().openFor402(detail);
        throw new Error("PAYMENT_REQUIRED");
      }
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to generate suggestion.");
      }
      const data = (await response.json()) as CoverLetterSuggestResponse;
      setSuggestion(data);
      setViewingPreview(true);
      setExternalContent(data.preview);
      setExternalSyncKey((prev) => prev + 1);
      setEditorKey((prev) => prev + 1);
      hydrateUserBase();
    } catch (err) {
      if (err instanceof Error && err.message === "PAYMENT_REQUIRED") {
        return;
      }
      setError(err instanceof Error ? err.message : "Suggestion failed.");
    } finally {
      setSuggesting(false);
    }
  };

  const handleAccept = async () => {
    if (!sessionId || !suggestion) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/editor/version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          job_id: jobId,
          content: suggestion.preview,
          intent: "accept",
          base_hash: draftHash,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to save version.");
      }
      setSuggestion(null);
      setViewingPreview(false);
      setContent(suggestion.preview);
      setExternalContent(suggestion.preview);
      setExternalSyncKey((prev) => prev + 1);
      await loadDocument();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Version save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVersion = async (intent: string, body?: string) => {
    if (!sessionId) return;
    setSavingVersion(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/editor/version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          job_id: jobId,
          content: body ?? content,
          intent,
          base_hash: draftHash,
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to save version.");
      }
      await loadDocument();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Version save failed.");
    } finally {
      setSavingVersion(false);
    }
  };

  const handleLoadVersion = async (version: CoverLetterVersion) => {
    setContent(version.content);
    setExternalContent(version.content);
    setExternalSyncKey((prev) => prev + 1);
    setEditorKey((prev) => prev + 1);
  };

  const renderDiffLines = (diffText: string) =>
    diffText.split("\n").map((line, index) => {
      let classes = "text-[11px] text-slate-300";
      if (line.startsWith("+++ ") || line.startsWith("--- ")) {
        classes = "text-[11px] text-slate-500";
      } else if (line.startsWith("@@")) {
        classes = "text-[11px] text-fuchsia-200";
      } else if (line.startsWith("+")) {
        classes = "text-[11px] text-emerald-200 bg-emerald-500/10";
      } else if (line.startsWith("-")) {
        classes = "text-[11px] text-red-200 bg-red-500/10";
      }
      return (
        <div key={`${line}-${index}`} className={`whitespace-pre-wrap ${classes}`}>
          {line || " "}
        </div>
      );
    });

  return (
    <div className="grid gap-4 md:grid-cols-2 md:min-h-[70vh]">
      <div className="flex flex-col gap-3 md:sticky md:top-4 md:self-start">
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/40 gap-3 p-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>
              {jobTitle ? `${jobTitle}` : "Cover letter"}
              {companyName ? ` · ${companyName}` : ""}
            </div>
            {saving || savingVersion ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                Saving
              </span>
            ) : (
              <span>Draft saved</span>
            )}
          </div>
          {viewingPreview ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
              AI preview is shown in the editor. Accept to keep it or Reject to
              discard.
            </div>
          ) : null}
          <div className=" max-h-[600px] overflow-y-auto bg-slate-950 px-3 py-3">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Spinner /> Loading draft
              </div>
            ) : (
              <LexicalComposer key={editorKey} initialConfig={initialConfig}>
                <PlainTextPlugin
                  ErrorBoundary={() => null}
                  contentEditable={
                    <ContentEditable
                      className={`min-h-[45vh] w-full text-sm leading-6 text-slate-100 outline-none ${viewingPreview ? "pointer-events-none opacity-80" : ""
                        }`}
                    />
                  }
                  placeholder={
                    <div className="pointer-events-none text-sm text-slate-500">
                      {DEFAULT_PLACEHOLDER}
                    </div>
                  }
                />
                <ExternalContentPlugin
                  content={externalContent}
                  syncKey={externalSyncKey}
                />
                <HistoryPlugin />
                <OnChangePlugin
                  onChange={(editorState) => {
                    if (viewingPreview) {
                      return;
                    }
                    editorState.read(() => {
                      const text = $getRoot().getTextContent();
                      setContent(text);
                    });
                  }}
                />
              </LexicalComposer>
            )}

          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 ">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-slate-700 text-xs text-slate-100"
              type="button"
                  onClick={() => handleSuggest("generate")}
                  disabled={disableAllButtons || !!content.trim()}
            >
              Generate from scratch
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 text-xs text-slate-100"
              type="button"
                  onClick={() => handleSuggest("tailor")}
                  disabled={disableAllButtons}
            >
              Tailor to job
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 text-xs text-slate-100"
              type="button"
                  onClick={() => handleSuggest("rewrite")}
                  disabled={disableAllButtons}
            >
              Rewrite
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 text-xs text-slate-100"
              type="button"
                  onClick={() => handleSuggest("shorten")}
                  disabled={disableAllButtons}
            >
              Shorten
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 text-xs text-slate-100"
              type="button"
                  onClick={() => handleSuggest("expand")}
                  disabled={disableAllButtons}
            >
              Expand
            </Button>
                <Button
                  variant="outline"
                  className="border-slate-700 text-xs text-slate-100"
                  type="button"
                  onClick={() => handleSaveVersion("manual")}
                  disabled={disableAllButtons}
                >
                  Save version
                </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            The assistant proposes edits. You stay in control with accept/reject.
          </p>
        </div>
        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start rounded-xl border border-slate-800 bg-slate-950/60 p-1">
            <TabsTrigger
              value="suggestion"
              className="text-xs text-slate-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
              disabled={disableAllButtons}
            >
              Suggestion
            </TabsTrigger>
            <TabsTrigger
              value="diff"
              className="text-xs text-slate-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
              disabled={disableAllButtons}
            >
              Diff
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              className="text-xs text-slate-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white"
              disabled={disableAllButtons}
            >
              Versions
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="suggestion"
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-200">Suggestion</p>
              {suggesting ? (
                <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                  <Spinner /> <small>Generating</small>
                </span>
              ) : null}
            </div>
            {suggestion ? (
              <>
                {suggestion.explanation ? (
                  <p className="mt-2 text-xs text-slate-300">
                    {suggestion.explanation}
                  </p>
                ) : null}
                {suggestion.warnings?.length ? (
                  <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                    {suggestion.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}
                <ButtonGroup className="mt-3">
                  <Button
                    variant="outline"
                    className="border-emerald-500/60 text-xs text-emerald-100"
                    type="button"
                    onClick={handleAccept}
                  disabled={disableAllButtons}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-700 text-xs text-slate-100"
                    type="button"
                    onClick={() => {
                      setSuggestion(null);
                      setViewingPreview(false);
                      setExternalContent(content);
                      setExternalSyncKey((prev) => prev + 1);
                      setEditorKey((prev) => prev + 1);
                    }}
                  disabled={disableAllButtons}
                  >
                    Reject
                  </Button>
                </ButtonGroup>
              </>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Trigger an AI action to see a suggested diff.
              </p>
            )}
          </TabsContent>
          <TabsContent
            value="diff"
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
          >
            <p className="text-xs font-semibold text-slate-200">Diff</p>
            <div className="mt-3 max-h-[700px] overflow-y-auto rounded-md bg-slate-950 p-2 font-mono">
              {suggestion?.diff
                ? renderDiffLines(suggestion.diff)
                : "No diff available."}
            </div>
          </TabsContent>
          <TabsContent
            value="versions"
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
          >
            <p className="text-xs font-semibold text-slate-200">Version history</p>
            {versions.length ? (
              <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="rounded-md border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-200">
                          {new Date(version.created_at).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {version.intent ?? "saved version"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="border-slate-700 text-[11px] text-slate-100"
                        type="button"
                        onClick={() => handleLoadVersion(version)}
                      disabled={disableAllButtons}
                      >
                        Load
                      </Button>
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-line text-[11px] text-slate-400">
                      {version.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                No versions saved yet. Accept a suggestion to create one.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
