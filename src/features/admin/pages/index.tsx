import { useState } from "react";
import { Icon, PageHeading } from "@/shared/ui/primitives";

export function ImportStudents() {
  const [file, setFile] = useState<File | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [error, setError] = useState("");
  function selectFile(selected: File | undefined) {
    setError("");
    setPreviewed(false);
    if (!selected) return;
    if (
      !selected.name.toLowerCase().endsWith(".csv") ||
      (selected.type &&
        selected.type !== "text/csv" &&
        selected.type !== "application/vnd.ms-excel")
    ) {
      setError("Please choose a .csv file.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("That file is larger than the 5 MB limit.");
      return;
    }
    setFile(selected);
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="DEPARTMENT ADMIN"
        title="Import students"
        subtitle="Preview every row before adding student records."
      />
      <section className="panel import-panel">
        <div className="import-drop">
          <span className="import-icon">
            <Icon name="import" size={22} />
          </span>
          <h2>Upload a student list</h2>
          <p>
            Choose a CSV file up to 5 MB. Your file is previewed before any
            records are created.
          </p>
          <label className="button secondary-button file-button">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </label>
          <small>CSV only · Maximum file size 5 MB</small>
          {file && <span className="selected-file">{file.name}</span>}
          {error && (
            <span className="form-error" role="alert">
              {error}
            </span>
          )}
        </div>
        {file && (
          <div className="import-footer">
            <span>
              {previewed
                ? "Preview ready · 2 rows need attention"
                : "Ready to preview your file"}
            </span>
            {previewed ? (
              <button className="button primary-button" disabled>
                Commit import
              </button>
            ) : (
              <button
                className="button primary-button"
                onClick={() => setPreviewed(true)}
              >
                Preview import
              </button>
            )}
          </div>
        )}
        {previewed && (
          <div className="preview-table">
            <h3>
              Preview results <span>2 rows · 1 issue</span>
            </h3>
            <div className="preview-row">
              <b>Row 2</b>
              <span>Amara Okafor</span>
              <span>2021 / 18420</span>
              <span className="status-chip verified">
                <i />
                Ready
              </span>
            </div>
            <div className="preview-row">
              <b>Row 3</b>
              <span>Chidi Nwosu</span>
              <span>Missing email</span>
              <span className="status-chip late">
                <i />
                Needs review
              </span>
            </div>
            <small>
              Row-level errors are capped at 200. Fix the source file and
              preview again before committing.
            </small>
          </div>
        )}
      </section>
    </div>
  );
}
