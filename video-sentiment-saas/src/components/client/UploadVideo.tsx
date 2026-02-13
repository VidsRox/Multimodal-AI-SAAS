"use client";

import { useState } from "react";
import { FiUpload } from "react-icons/fi";
import type { Analysis } from "./Inference";

interface UploadVideoProps {
  apiKey: string;
  onAnalysis: (analysis: Analysis) => void;
}

type UploadStatus = "idle" | "uploading" | "processing" | "polling";

function UploadVideo({ apiKey, onAnalysis }: UploadVideoProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  // ✅ Polling function (declared FIRST to avoid TS hoisting error)
  const pollForResults = async (fileId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async (): Promise<void> => {
      try {
        attempts++;
        setPollCount(attempts);

        const response = await fetch(
          `/api/analysis-status?fileId=${fileId}`,
          {
            headers: {
              Authorization: "Bearer " + apiKey,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to check analysis status");
        }

        const data = await response.json();
        console.log(`Poll #${attempts}:`, data.status);

        if (data.status === "completed") {
          console.log("Analysis complete!", data.analysis);
          onAnalysis(data.analysis);
          setStatus("idle");
          setPollCount(0);
        } else if (data.status === "failed") {
          throw new Error(data.message || "Analysis failed");
        } else if (data.status === "processing") {
          if (attempts >= maxAttempts) {
            throw new Error("Analysis timeout - processing too long");
          }
          setTimeout(() => poll(), 5000);
        }
      } catch (err) {
        console.error("Polling error:", err);
        setError(err instanceof Error ? err.message : "Failed to get results");
        setStatus("idle");
        setPollCount(0);
      }
    };

    await poll();
  };

  const handleUpload = async (file: File) => {
    try {
      setStatus("uploading");
      setError(null);
      setPollCount(0);

      // Validate file
      if (file.name.startsWith("._")) {
        throw new Error("Invalid file - select the real video file");
      }

      if (file.size < 1000) {
        throw new Error(
          `File too small (${file.size} bytes) - select a valid video`
        );
      }

      console.log(
        `Starting upload: ${file.name}, size: ${file.size} bytes`
      );

      // ✅ Step 1: Get signed upload URL
      const uploadRes = await fetch("/api/direct-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData?.error || "Failed to get upload URL");
      }

      const uploadData = await uploadRes.json();
      const { uploadUrl, fileId } = uploadData;

      if (!uploadUrl || !fileId) {
        console.error("Invalid upload response:", uploadData);
        throw new Error("Upload initialization failed");
      }

      console.log("Uploading directly to S3...");

      // ✅ Step 2: Upload directly to S3
      const s3Upload = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!s3Upload.ok) {
        throw new Error("Failed to upload to S3");
      }

      console.log("S3 upload complete");

      // ✅ Step 3: Start analysis
      setStatus("processing");

      const analysisRes = await fetch("/api/start-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: JSON.stringify({ fileId }),
      });

      if (!analysisRes.ok) {
        const errorData = await analysisRes.json();
        throw new Error(errorData?.error || "Failed to start analysis");
      }

      console.log("Analysis started");

      // ✅ Step 4: Poll for results
      setStatus("polling");
      await pollForResults(fileId);

    } catch (error) {
      console.error("Upload failed", error);
      setError(error instanceof Error ? error.message : "Upload failed");
      setStatus("idle");
    }
  };

  const getStatusText = () => {
    if (status === "uploading") return "Uploading...";
    if (status === "processing") return "Starting analysis...";
    if (status === "polling") return `Analyzing... (${pollCount})`;
    return "Upload a video";
  };

  const getStatusDescription = () => {
    if (status === "uploading") {
      return "Uploading your video to the cloud";
    }
    if (status === "processing") {
      return "Initializing sentiment analysis";
    }
    if (status === "polling") {
      return "Processing video - this may take 1-2 minutes";
    }
    return "Get started with sentiment detection by uploading a video.";
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 p-10">
        <input
          type="file"
          accept="video/mp4,video/mov,video/avi"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
          id="video-upload"
          disabled={status !== "idle"}
        />
        <label
          htmlFor="video-upload"
          className={`flex cursor-pointer flex-col items-center ${
            status !== "idle" ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <FiUpload className="min-h-8 min-w-8 text-gray-400" />
          <h3 className="text-md mt-2 text-slate-800">
            {getStatusText()}
          </h3>
          <p className="text-center text-xs text-gray-500">
            {getStatusDescription()}
          </p>
        </label>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}
    </div>
  );
}

export default UploadVideo;
