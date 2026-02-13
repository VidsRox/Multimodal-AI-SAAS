// src/app/api/analysis-status/route.ts
import { NextResponse } from "next/server"
import { db } from "~/server/db"

export async function GET(req: Request) {
  try {
    const apiKey = req.headers.get("Authorization")?.replace("Bearer ", "").trim()
    
    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 })
    }

    // Verify API key
    const quota = await db.apiQuota.findUnique({
      where: { secretKey: apiKey },
      select: { userId: true },
    })

    if (!quota) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }

    // Get fileId from query params
    const { searchParams } = new URL(req.url)
    const fileId = searchParams.get("fileId")

    if (!fileId) {
      return NextResponse.json({ error: "File ID required" }, { status: 400 })
    }

    // Get video file with utterances
    const videoFile = await db.videoFile.findUnique({
      where: { id: fileId },
      select: {
        analyzed: true,
        userId: true,
        utterances: {
          select: {
            startTime: true,
            endTime: true,
            text: true,
            emotions: true,
            sentiments: true,
          },
        },
      },
    })

    if (!videoFile) {
      return NextResponse.json({ error: "Video file not found" }, { status: 404 })
    }

    // Verify ownership
    if (videoFile.userId !== quota.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Check status
    if (!videoFile.analyzed) {
      return NextResponse.json({
        status: "processing",
        message: "Analysis in progress",
      })
    }

    // Analysis complete
    if (videoFile.utterances.length === 0) {
      return NextResponse.json({
        status: "failed",
        message: "Analysis completed but no utterances found",
      })
    }

    // Prisma already parses JSON fields, no need to JSON.parse
    const analysisData = {
      analysis: {
        utterances: videoFile.utterances.map((u) => ({
          start_time: u.startTime,
          end_time: u.endTime,
          text: u.text,
          emotions: u.emotions,  // Already an object, not a string
          sentiments: u.sentiments,  // Already an object, not a string
        })),
      }
    }

    return NextResponse.json({
      status: "completed",
      analysis: analysisData,  // This creates the nested structure: { analysis: { analysis: { utterances } } }
    })

  } catch (error) {
    console.error("Analysis status error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}