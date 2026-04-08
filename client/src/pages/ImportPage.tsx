import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import api from "../lib/api.js";

type ImportResult = { imported: number; duplicates?: string[] };
type ProcessResult = { processed: number };
type StagedInfo = { monzo: number; amex: number; barclays: number; santander: number; processedCount: number };

function BankUploadCard({
  title,
  description,
  onUpload,
  result,
  isPending,
  isError,
  error,
  onFileChange,
  file,
  fileRef,
  accept = ".csv",
  owner,
  onOwnerChange,
}: {
  title: string;
  description: string;
  onUpload: () => void;
  result: ImportResult | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  onFileChange: (f: File | null) => void;
  file: File | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  accept?: string;
  owner?: string;
  onOwnerChange?: (owner: string) => void;
}) {
  const [showDuplicates, setShowDuplicates] = useState(false);
  const inputId = `file-${title.toLowerCase()}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center gap-3">
          {onOwnerChange && (
            <select
              value={owner}
              onChange={(e) => onOwnerChange(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="Alex">Alex</option>
              <option value="Casey">Casey</option>
              <option value="Joint">Joint</option>
            </select>
          )}
          <label
            htmlFor={inputId}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Upload className="h-4 w-4" />
            {file ? file.name : "Choose file…"}
          </label>
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => {
              onFileChange(e.target.files?.[0] ?? null);
              setShowDuplicates(false);
            }}
          />
          <Button disabled={!file || isPending} onClick={onUpload}>
            {isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>

        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              {result.imported.toLocaleString()} rows staged
              {(result.duplicates?.length ?? 0) > 0 && (
                <span className="text-muted-foreground">
                  · {result.duplicates!.length} already existed
                </span>
              )}
            </div>
            {(result.duplicates?.length ?? 0) > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowDuplicates((v) => !v)}
                >
                  {showDuplicates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showDuplicates ? "Hide" : "Show"} duplicate IDs
                </button>
                {showDuplicates && (
                  <div className="mt-2 rounded-md border border-input bg-muted/50 p-3 max-h-48 overflow-y-auto">
                    {result.duplicates!.map((id) => (
                      <div key={id} className="font-mono text-xs text-muted-foreground">
                        {id}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error?.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ImportPage() {
  const queryClient = useQueryClient();
  const monzoFileRef = useRef<HTMLInputElement>(null);
  const amexFileRef = useRef<HTMLInputElement>(null);
  const barclaysFileRef = useRef<HTMLInputElement>(null);
  const santanderFileRef = useRef<HTMLInputElement>(null);
  const [monzoFile, setMonzoFile] = useState<File | null>(null);
  const [amexFile, setAmexFile] = useState<File | null>(null);
  const [barclaysFile, setBarclaysFile] = useState<File | null>(null);
  const [santanderFile, setSantanderFile] = useState<File | null>(null);
  const [amexOwner, setAmexOwner] = useState("Alex");
  const [barclaysOwner, setBarclaysOwner] = useState("Alex");
  const [santanderOwner, setSantanderOwner] = useState("Alex");

  const { data: staged, refetch: refetchStaged } = useQuery<StagedInfo>({
    queryKey: ["staged"],
    queryFn: () => api.get("/api/admin/staged").then((r) => r.data),
  });

  const monzoMutation = useMutation<ImportResult, Error, File>({
    mutationFn: (f) => {
      const form = new FormData();
      form.append("file", f);
      return api.post("/api/admin/import/monzo", form).then((r) => r.data);
    },
    onSuccess: () => {
      refetchStaged();
      setMonzoFile(null);
      if (monzoFileRef.current) monzoFileRef.current.value = "";
    },
  });

  const amexMutation = useMutation<ImportResult, Error, { file: File; owner: string }>({
    mutationFn: ({ file, owner }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("owner", owner);
      return api.post("/api/admin/import/amex", form).then((r) => r.data);
    },
    onSuccess: () => {
      refetchStaged();
      setAmexFile(null);
      if (amexFileRef.current) amexFileRef.current.value = "";
    },
  });

  const barclaysMutation = useMutation<ImportResult, Error, { file: File; owner: string }>({
    mutationFn: ({ file, owner }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("owner", owner);
      return api.post("/api/admin/import/barclays", form).then((r) => r.data);
    },
    onSuccess: () => {
      refetchStaged();
      setBarclaysFile(null);
      if (barclaysFileRef.current) barclaysFileRef.current.value = "";
    },
  });

  const santanderMutation = useMutation<ImportResult, Error, { file: File; owner: string }>({
    mutationFn: ({ file, owner }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("owner", owner);
      return api.post("/api/admin/import/santander", form).then((r) => r.data);
    },
    onSuccess: () => {
      refetchStaged();
      setSantanderFile(null);
      if (santanderFileRef.current) santanderFileRef.current.value = "";
    },
  });

  const processMutation = useMutation<ProcessResult, Error>({
    mutationFn: () => api.post("/api/admin/process").then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      refetchStaged();
    },
  });

  const totalStaged = (staged?.monzo ?? 0) + (staged?.amex ?? 0) + (staged?.barclays ?? 0) + (staged?.santander ?? 0);
  const unprocessed = totalStaged - (staged?.processedCount ?? 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Import</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wide mt-1">
          Upload bank statements
        </p>
      </div>

      {/* Staging status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
            Staging
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalStaged === 0 ? (
            <p className="text-sm text-muted-foreground">No staged transactions yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="font-medium text-foreground">Monzo</span>
                  <span className="text-muted-foreground ml-1">{staged?.monzo.toLocaleString()} rows</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Amex</span>
                  <span className="text-muted-foreground ml-1">{staged?.amex.toLocaleString()} rows</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Barclays</span>
                  <span className="text-muted-foreground ml-1">{staged?.barclays.toLocaleString()} rows</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Santander</span>
                  <span className="text-muted-foreground ml-1">{staged?.santander.toLocaleString()} rows</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {staged?.processedCount.toLocaleString()} processed ·{" "}
                  <span className={unprocessed > 0 ? "text-foreground font-medium" : ""}>
                    {unprocessed.toLocaleString()} pending
                  </span>
                </span>
                <Button
                  size="sm"
                  disabled={unprocessed === 0 || processMutation.isPending}
                  onClick={() => processMutation.mutate()}
                >
                  {processMutation.isPending ? "Processing…" : "Process staged"}
                </Button>
              </div>
              {processMutation.isSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  {processMutation.data.processed.toLocaleString()} transactions added to dashboard
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active bank upload cards */}
      <BankUploadCard
        title="Monzo"
        description="Export from Monzo → Account → Statements → Download CSV."
        file={monzoFile}
        fileRef={monzoFileRef}
        onFileChange={(f) => { setMonzoFile(f); monzoMutation.reset(); }}
        onUpload={() => monzoFile && monzoMutation.mutate(monzoFile)}
        result={monzoMutation.data}
        isPending={monzoMutation.isPending}
        isError={monzoMutation.isError}
        error={monzoMutation.error}
      />

      <BankUploadCard
        title="Amex"
        description="Download from Amex online → Statements → View/Download PDF."
        accept=".pdf"
        file={amexFile}
        fileRef={amexFileRef}
        onFileChange={(f) => { setAmexFile(f); amexMutation.reset(); }}
        onUpload={() => amexFile && amexMutation.mutate({ file: amexFile, owner: amexOwner })}
        result={amexMutation.data}
        isPending={amexMutation.isPending}
        isError={amexMutation.isError}
        error={amexMutation.error}
        owner={amexOwner}
        onOwnerChange={setAmexOwner}
      />

      <BankUploadCard
        title="Barclays"
        description="Download from Barclays online → Statements → View statement → Save as PDF."
        accept=".pdf"
        file={barclaysFile}
        fileRef={barclaysFileRef}
        onFileChange={(f) => { setBarclaysFile(f); barclaysMutation.reset(); }}
        onUpload={() => barclaysFile && barclaysMutation.mutate({ file: barclaysFile, owner: barclaysOwner })}
        result={barclaysMutation.data}
        isPending={barclaysMutation.isPending}
        isError={barclaysMutation.isError}
        error={barclaysMutation.error}
        owner={barclaysOwner}
        onOwnerChange={setBarclaysOwner}
      />

      <BankUploadCard
        title="Santander"
        description="Download from Santander online → My Accounts → Statements → Download PDF."
        accept=".pdf"
        file={santanderFile}
        fileRef={santanderFileRef}
        onFileChange={(f) => { setSantanderFile(f); santanderMutation.reset(); }}
        onUpload={() => santanderFile && santanderMutation.mutate({ file: santanderFile, owner: santanderOwner })}
        result={santanderMutation.data}
        isPending={santanderMutation.isPending}
        isError={santanderMutation.isError}
        error={santanderMutation.error}
        owner={santanderOwner}
        onOwnerChange={setSantanderOwner}
      />
    </div>
  );
}
