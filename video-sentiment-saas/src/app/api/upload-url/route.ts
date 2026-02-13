import { NextResponse } from "next/server"
import { env } from "~/env";
import { db } from "~/server/db"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(req: Request) {
    try{
        //Get API key from header
        const apiKey = req.headers.get("Authorization")?.replace("Bearer ", "")
        if(!apiKey) {
            return NextResponse.json({error: "API key required"}, {status: 401})
        }

        //find user by API key
        const quota = await db.apiQuota.findUnique({
            where: {
                secretKey: apiKey
            },
            select: {
                userId: true
            }
        })

        if (!quota) {
            return NextResponse.json({error: "Invalid API key"}, {status: 401})
        }

        const {fileType} = await req.json();

        if (!fileType || !fileType.match(/\.(mp4|mov|avi)$/i)) {
            return NextResponse.json(
                { error: "Invalid file type. Only .mp4, .mov, .avi are supported" },
                { status: 400 }
            )
        }

        //generate upload url
        const s3Client = new S3Client({
            region: env.AWS_REGION,
            credentials: {
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY
            }
        })

        const id = crypto.randomUUID();
        const key = `inference/${id}${fileType}`

        const contentType = `video/${fileType.replace(".", "")}`;
        
        const command = new PutObjectCommand({
            Bucket: env.AWS_INFERENCE_BUCKET,
            Key: key,
            ContentType: contentType,
        })

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        await db.videoFile.create ({
            data: {
                key: key,
                userId: quota.userId,
                analyzed: false
            }
        })

        return NextResponse.json({
            url,
            fileId: id,
            fileType,
            key,
            contentType
        })


    } catch (error) {
        console.error("Upload error: ", error)
        return NextResponse.json({error:"Internal server error"}, {status: 500})
    }
}