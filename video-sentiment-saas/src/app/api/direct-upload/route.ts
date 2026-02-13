import { NextResponse } from "next/server"
import { env } from "~/env"
import { db } from "~/server/db"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("Authorization")?.replace("Bearer ", "").trim()

    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 })
    }

    const quota = await db.apiQuota.findUnique({
      where: { secretKey: apiKey },
      select: { userId: true }
    })

    if (!quota) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }

    const { fileName, fileType } = await req.json()

    if (!fileName || !fileType) {
      return NextResponse.json({ error: "fileName and fileType required" }, { status: 400 })
    }

    if (!fileName.match(/\.(mp4|mov|avi)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type" },
        { status: 400 }
      )
    }

    const s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    })

    const id = crypto.randomUUID()
    const key = `inference/${id}.${fileName.split(".").pop()}`

    const command = new PutObjectCommand({
      Bucket: env.AWS_INFERENCE_BUCKET,
      Key: key,
      ContentType: fileType,
    })

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 5, // 5 min
    })

    await db.videoFile.create({
      data: {
        id,
        key,
        userId: quota.userId,
        analyzed: false,
      },
    })

    return NextResponse.json({
      uploadUrl,
      key,
      fileId: id,
    })

  } catch (error) {
    console.error("Upload URL error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
