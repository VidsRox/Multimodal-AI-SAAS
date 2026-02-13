// src/app/api/start-analysis/route.ts
import { NextResponse } from "next/server"
import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime"
import { db } from "~/server/db"

const sagemakerClient = new SageMakerRuntimeClient({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: Request) {
  try {
    console.log("[start-analysis] Request received")
    
    // 1. Verify API key
    const apiKey = req.headers.get("Authorization")?.replace("Bearer ", "").trim()
    if (!apiKey) {
      console.log("[start-analysis] No API key provided")
      return NextResponse.json({ error: "API key required" }, { status: 401 })
    }

    const quota = await db.apiQuota.findUnique({
      where: { secretKey: apiKey },
    })

    if (!quota) {
      console.log("[start-analysis] Invalid API key")
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }

    console.log("[start-analysis] API key valid, userId:", quota.userId)

    // 2. Get the video file info
    const body = await req.json()
    const { fileId } = body

    console.log("[start-analysis] Request body:", body)
    console.log("[start-analysis] Looking for fileId:", fileId)

    if (!fileId) {
      console.log("[start-analysis] No fileId provided in request")
      return NextResponse.json({ error: "fileId required" }, { status: 400 })
    }

    const videoFile = await db.videoFile.findUnique({
      where: { id: fileId },
    })

    console.log("[start-analysis] Database lookup result:", videoFile ? "Found" : "Not found")
    console.log("[start-analysis] VideoFile data:", JSON.stringify(videoFile, null, 2))

    if (!videoFile) {
      console.log("[start-analysis] Video file not found in database for fileId:", fileId)
      return NextResponse.json({ error: "Video file not found" }, { status: 404 })
    }

    if (videoFile.userId !== quota.userId) {
      console.log("[start-analysis] User mismatch. File userId:", videoFile.userId, "Quota userId:", quota.userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    console.log("[start-analysis] Authorization passed, starting processing")

    // 3. Update status to processing
    await db.videoFile.update({
      where: { id: fileId },
      data: {
        analyzed: false,
      },
    })

    console.log("[start-analysis] Database updated, launching background job")

    // 4. Start async processing (fire and forget)
    processVideoAsync(fileId, videoFile.key, quota.userId).catch(error => {
      console.error("[start-analysis] Background processing error:", error)
    })

    console.log("[start-analysis] Returning success response")

    // 5. Return immediately
    return NextResponse.json({
      fileId,
      status: "processing",
      message: "Analysis started. Use /api/analysis-status to check progress.",
    })

  } catch (error) {
    console.error("[start-analysis] Route error:", error)
    return NextResponse.json(
      { error: "Failed to start analysis", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// Background processing function
async function processVideoAsync(fileId: string, s3Key: string, userId: string) {
  try {
    console.log(`[Background] Starting analysis for file: ${fileId}`)

    // Invoke SageMaker
    const command = new InvokeEndpointCommand({
      EndpointName: process.env.SAGEMAKER_ENDPOINT_NAME || "sentiment-analysis-endpoint",
      ContentType: "application/json",
      Body: JSON.stringify({
        video_path: `s3://meld-sentiment-analysis-saas/${s3Key}`,
      }),
    })

    const response = await sagemakerClient.send(command)
    const analysis = JSON.parse(new TextDecoder().decode(response.Body))

    console.log(`[Background] Analysis complete for file: ${fileId}`)

    // Update database with results
    // Step 1: Mark video as analyzed
    await db.videoFile.update({
      where: { id: fileId },
      data: {
        analyzed: true,
      },
    })

    // Step 2: Create utterances separately
    if (analysis.utterances && analysis.utterances.length > 0) {
      await db.utterance.createMany({
        data: analysis.utterances.map((utterance: any) => ({
          videoFileId: fileId,
          startTime: utterance.start_time,
          endTime: utterance.end_time,
          text: utterance.text,
          emotions: utterance.emotions,
          sentiments: utterance.sentiments,
        })),
      })
    }

    // Increment API quota usage
    const quota = await db.apiQuota.findUnique({
      where: { userId },
    })

    if (quota) {
      await db.apiQuota.update({
        where: { userId },
        data: { requestUsed: quota.requestUsed + 1 },
      })
    }

    console.log(`[Background] Successfully saved results for file: ${fileId}`)

  } catch (error) {
    console.error(`[Background] Processing failed for file: ${fileId}`, error)

    // Mark as failed in database
    await db.videoFile.update({
      where: { id: fileId },
      data: {
        analyzed: false,
      },
    }).catch(e => console.error("[Background] Failed to update error state:", e))
  }
}