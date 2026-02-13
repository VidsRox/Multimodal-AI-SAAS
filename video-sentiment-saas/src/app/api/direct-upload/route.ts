import { NextResponse } from "next/server"
import { env } from "~/env";
import { db } from "~/server/db"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

export async function POST(req: Request) {
    try {
        const apiKey = req.headers.get("Authorization")?.replace("Bearer ", "").trim()
        if (!apiKey) {
            return NextResponse.json({error: "API key required"}, {status: 401})
        }

        const quota = await db.apiQuota.findUnique({
            where: { secretKey: apiKey },
            select: { userId: true }
        })

        if (!quota) {
            return NextResponse.json({error: "Invalid API key"}, {status: 401})
        }

        const formData = await req.formData()
        const file = formData.get("file") as File
        
        if (!file) {
            return NextResponse.json({error: "No file provided"}, {status: 400})
        }

        const fileName = file.name
        const fileType = `.${fileName.split(".").pop()}`

        if (!fileType.match(/\.(mp4|mov|avi)$/i)) {
            return NextResponse.json(
                { error: "Invalid file type. Only .mp4, .mov, .avi are supported" },
                { status: 400 }
            )
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        console.log(`Uploading file: ${fileName}, size: ${buffer.length} bytes`)

        const s3Client = new S3Client({
            region: env.AWS_REGION,
            credentials: {
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY
            }
        })

        const id = crypto.randomUUID()
        const key = `inference/${id}${fileType}`

        await s3Client.send(new PutObjectCommand({
            Bucket: env.AWS_INFERENCE_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: file.type,
        }))

        console.log(`Successfully uploaded to S3: ${key}, size: ${buffer.length}`)

        await db.videoFile.create({
            data: {
                id: id,
                key: key,
                userId: quota.userId,
                analyzed: false
            }
        })

        return NextResponse.json({
            fileId: id,
            key,
            size: buffer.length
        })

    } catch (error) {
        console.error("Upload error: ", error)
        return NextResponse.json({error: "Internal server error"}, {status: 500})
    }
}