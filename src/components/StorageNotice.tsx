import type { Me } from "@/lib/types";

const mb = (bytes: number) => `${Math.ceil(bytes / (1024 * 1024)).toLocaleString()} MB`;

/** Shown on every screen while a Free account is over the Free storage limits after its pass or trial
 *  ended: how far over, and the date the oldest files beyond the limit will be deleted (recall.prune). */
export function StorageNotice({ me, onLibrary, onPlans }: { me: Me | null; onLibrary: () => void; onPlans: () => void }) {
  const s = me?.storage;
  if (!s?.over_free_limit) return null;
  const files = me?.limits?.find((l) => l.key === "max_files")?.free;
  const storage = me?.limits?.find((l) => l.key === "max_storage_mb")?.free;
  const when = s.delete_after ? new Date(s.delete_after) : null;
  const date = when?.toLocaleDateString(undefined, { dateStyle: "long" });
  return (
    <div role="status" className="sheet mb-6 border-danger/50 px-5 py-4 text-sm">
      <p className="font-semibold">
        Your files are over the Free plan limit
        {storage != null && <>: {mb(s.used_bytes)} of {storage} MB</>}
        {files != null && <>, {s.files} of {files} files</>}.
      </p>
      <p className="mt-1 text-muted">
        {when && when > new Date()
          ? <>On <span className="font-semibold text-fg">{date}</span>, your oldest files beyond the Free limit will be deleted. </>
          : <>Your oldest files beyond the Free limit may now be deleted at any time. </>}
        Delete some files, or buy a pass to keep them all.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onLibrary} className="btn">Go to Library</button>
        <button onClick={onPlans} className="btn-primary">See plans</button>
      </div>
    </div>
  );
}
