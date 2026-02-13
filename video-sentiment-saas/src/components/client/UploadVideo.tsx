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

  const handleUpload = async (file: File) => {
    try {
      setStatus("uploading");
      setError(null);
      setPollCount(0);

      // Validate file
      if (file.name.startsWith("._")) {
        throw new Error("Invalid file - please select the actual video file, not the metadata file");
      }
      
      if (file.size < 1000) {
        throw new Error(`File too small (${file.size} bytes) - please select a valid video file`);
      }

      console.log(`Starting upload: ${file.name}, size: ${file.size} bytes`);

      // Step 1: Upload file to S3
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/direct-upload", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
        },
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData?.error || "Failed to upload file");
      }

      const uploadData = await uploadRes.json();
      console.log(`Upload successful:`, uploadData);
      
      // The direct-upload route should return the database record ID
      // Check what fields are actually returned
      const videoFileId = uploadData.id || uploadData.fileId;
      
      if (!videoFileId) {
        console.error("Upload response missing ID:", uploadData);
        throw new Error("Upload succeeded but no file ID returned");
      }

      console.log(`Using videoFileId: ${videoFileId}`);

      // Step 2: Start analysis (async)
      setStatus("processing");
      
      const analysisRes = await fetch("/api/start-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: JSON.stringify({ fileId: videoFileId }),
      });

      if (!analysisRes.ok) {
        const errorData = await analysisRes.json();
        console.error("Analysis start failed:", errorData);
        throw new Error(errorData?.error || "Failed to start analysis");
      }

      const analysisData = await analysisRes.json();
      console.log("Analysis started:", analysisData);

      // Step 3: Poll for results
      setStatus("polling");
      await pollForResults(videoFileId);

    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed");
      console.error("Upload failed", error);
      setStatus("idle");
    }
  };

  const pollForResults = async (fileId: string) => {
    const maxAttempts = 60; // Poll for up to 5 minutes
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
          // Success! Analysis complete
          console.log("Analysis complete!", data.analysis);
          onAnalysis(data.analysis);
          setStatus("idle");
          setPollCount(0);
        } else if (data.status === "failed") {
          throw new Error(data.message || "Analysis failed");
        } else if (data.status === "processing") {
          // Still processing
          if (attempts >= maxAttempts) {
            throw new Error("Analysis timeout - processing is taking too long");
          }
          
          // Poll again in 5 seconds
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
          <h3 className="text-md mt-2 from-indigo-50 text-slate-800">
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