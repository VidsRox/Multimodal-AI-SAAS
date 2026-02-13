# 🎭 Multimodal Video Sentiment Analysis SaaS

Production-ready sentiment and emotion detection from video using multi-modal deep learning. Built with PyTorch, AWS SageMaker, and Next.js 15.


> **📦 Project Structure:** This repository contains two main directories:
> - `sentiment-model/` - ML training, model artifacts, and SageMaker deployment
> - `video-sentiment-saas/` - Next.js SaaS application with frontend and API

## 🎯 Features

- **🎬 Video Analysis**: Upload videos and get per-utterance emotion & sentiment scores
- **🧠 Multi-Modal AI**: Combines video frames (ResNet3D), audio (CNN), and text (RoBERTa + DistilBERT)
- **📊 7 Emotions + 3 Sentiments**: Detects anger, disgust, fear, joy, neutral, sadness, surprise + positive/negative/neutral sentiment
- **☁️ Cloud Production**: Deployed on AWS SageMaker with GPU inference (ml.g5.xlarge)
- **🔐 SaaS Ready**: User authentication, API quotas, S3 storage, async processing
- **⚡ Real-time**: Async polling architecture for smooth UX with long-running inference

## 🏗️ Tech Stack

**Machine Learning:**
- PyTorch 2.5.1
- Whisper (audio transcription)
- RoBERTa (emotion classification)
- DistilBERT (sentiment analysis)
- Late fusion architecture

**Cloud Infrastructure:**
- AWS SageMaker (training + inference)
- AWS S3 (video storage)
- CloudWatch (logging)

**SaaS Application:**
- Next.js 15 (App Router)
- NextAuth.js (authentication)
- Prisma ORM
- PostgreSQL database
- Tailwind CSS + shadcn/ui

## 🚀 Live Demo

**[https://multimodal-ai-saas.vercel.app](https://multimodal-ai-saas.vercel.app)**

Try it: Upload a video → Get detailed emotion analysis for each spoken utterance

## 📁 Project Structure

```
├── sentiment-model/               # ML Training & Deployment
│   ├── dataset/                   # MELD dataset (train/dev/test)
│   ├── training/                  # Model training code
│   │   ├── meld_dataset.py        # PyTorch dataset loader
│   │   ├── models.py              # Multi-modal architecture
│   │   ├── train.py               # Training script
│   │   └── requirements.txt
│   ├── deployment/                # SageMaker deployment
│   │   ├── inference.py           # Endpoint handler (Whisper + RoBERTa + DistilBERT)
│   │   ├── models.py              # Model definitions
│   │   ├── requirements.txt       # Inference dependencies
│   │   ├── model.tar.gz           # Packaged model artifact
│   │   ├── create_model_package.py
│   │   └── deploy_endpoint.py
│   ├── train_sagemaker.py         # SageMaker training job launcher
│   └── MELD.Raw.tar.gz            # Raw dataset archive
│
└── video-sentiment-saas/          # Next.js SaaS Application
    ├── src/
    │   ├── app/
    │   │   ├── api/               # API Routes
    │   │   │   ├── direct-upload/     # S3 upload handler
    │   │   │   ├── start-analysis/    # Async inference trigger
    │   │   │   ├── analysis-status/   # Polling endpoint
    │   │   │   ├── sentiment-inference/  # Legacy sync endpoint
    │   │   │   ├── upload-url/        # Presigned URL (deprecated)
    │   │   │   └── auth/              # NextAuth API routes
    │   │   ├── login/             # Login page
    │   │   ├── signup/            # Signup page
    │   │   ├── page.tsx           # Landing page (dashboard)
    │   │   └── layout.tsx         # Root layout
    │   │
    │   ├── components/            # React Components
    │   │   ├── client/            # Client components
    │   │   │   ├── Inference.tsx      # Main analysis UI
    │   │   │   └── UploadVideo.tsx    # Upload + polling logic
    │   │   └── ui/                # shadcn/ui components
    │   │
    │   ├── server/                # Backend Config
    │   │   ├── auth/
    │   │   │   ├── config.ts      # NextAuth configuration
    │   │   │   └── index.ts       # Auth exports
    │   │   └── db.ts              # Prisma client
    │   │
    │   ├── actions/               # Server actions
    │   │   └── auth.ts
    │   ├── schemas/               # Zod validation schemas
    │   │   └── auth.ts
    │   ├── styles/
    │   │   └── globals.css
    │   ├── env.js                 # Environment validation
    │   └── middleware.ts          # Auth middleware
    │
    ├── prisma/
    │   └── schema.prisma          # Database schema
    ├── generated/                 # Prisma generated client
    ├── public/                    # Static assets
    └── package.json
```

## 🔧 Setup & Deployment

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/video-sentiment-saas.git
cd video-sentiment-saas
```

### 2. Install Dependencies

```bash
# SaaS app
cd video-sentiment-saas
npm install

# ML training (optional - if you want to train from scratch)
cd ../sentiment-model/training
pip install -r requirements.txt
```

### 3. Environment Variables

Create `video-sentiment-saas/.env` file:

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# AWS Credentials
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"

# S3 Configuration
S3_BUCKET_NAME="your-video-bucket"

# SageMaker
SAGEMAKER_ENDPOINT_NAME="sentiment-endpoint"
```

### 4. Database Setup

```bash
cd video-sentiment-saas
npx prisma db push
npx prisma generate
```

### 5. Deploy SageMaker Endpoint

```bash
cd sentiment-model/deployment

# Package model code (already done - model.tar.gz exists)
# If you need to repackage:
# tar czf model.tar.gz inference.py models.py requirements.txt

# Upload to S3
aws s3 cp model.tar.gz s3://your-sagemaker-bucket/models/

# Create SageMaker model
aws sagemaker create-model \
  --model-name sentiment-analysis-model \
  --primary-container \
    Image=763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:2.0.0-gpu-py310,\
    ModelDataUrl=s3://your-sagemaker-bucket/models/model.tar.gz \
  --execution-role-arn arn:aws:iam::YOUR_ACCOUNT:role/SageMakerExecutionRole

# Create endpoint configuration
aws sagemaker create-endpoint-config \
  --endpoint-config-name sentiment-endpoint-config \
  --production-variants \
    VariantName=AllTraffic,\
    ModelName=sentiment-analysis-model,\
    InstanceType=ml.g5.xlarge,\
    InitialInstanceCount=1

# Create endpoint (takes ~5-10 minutes)
aws sagemaker create-endpoint \
  --endpoint-name sentiment-endpoint \
  --endpoint-config-name sentiment-endpoint-config

# Check status
aws sagemaker describe-endpoint --endpoint-name sentiment-endpoint
```

**Alternative: Use Python scripts**

```bash
cd sentiment-model/deployment

# Package and upload
python create_model_package.py

# Deploy endpoint
python deploy_endpoint.py
```

### 6. Run Development Server

```bash
cd video-sentiment-saas
npm run dev
```

Visit `http://localhost:3000`

## 🎓 How It Works

### Inference Pipeline

```
Video Upload → S3 Storage
     ↓
Database Record Created
     ↓
Async Analysis Started (returns immediately)
     ↓
SageMaker Endpoint:
  1. Whisper transcribes audio → utterances
  2. For each utterance:
     - RoBERTa → emotion scores (7 classes)
     - DistilBERT → sentiment scores (3 classes)
     ↓
Results saved to database
     ↓
Frontend polls every 5s → displays results
```

### Key Components

**Async Processing Architecture:**
- `start-analysis` route triggers SageMaker but returns immediately
- Analysis runs in background (can take 60-90 seconds)
- `analysis-status` route polls for completion
- Frontend polls every 5 seconds with visual progress indicator

**SageMaker inference.py:**
1. Downloads video from S3
2. Validates file size (detects corrupted uploads)
3. Uses Whisper for speech-to-text with timestamps
4. Runs emotion + sentiment models on each utterance
5. Returns structured JSON with all scores

## 📊 Model Performance

| Metric | Score |
|--------|-------|
| Emotion Detection | 7 classes (anger, disgust, fear, joy, neutral, sadness, surprise) |
| Sentiment Detection | 3 classes (positive, negative, neutral) |
| Average Inference Time | 60-90 seconds (depends on video length) |
| Endpoint Instance | ml.g5.xlarge (GPU) |

## 🐛 Debugging & Troubleshooting

**Common Issues Fixed During Development:**

### 1. 212-byte Corrupted Files in S3
**Problem:** Presigned URL uploads creating tiny corrupted files  
**Solution:** Switched to direct server-side upload using `PutObjectCommand`
```typescript
// ❌ Don't use presigned URLs with FormData
// ✅ Use direct server-side upload in /api/direct-upload
const command = new PutObjectCommand({
  Bucket: bucketName,
  Key: key,
  Body: buffer,
  ContentType: file.type,
});
```

### 2. SageMaker 60-Second Timeout
**Problem:** Inference takes 60-90 seconds but API Gateway times out at 60s  
**Solution:** Implemented async processing with polling
```typescript
// ❌ Don't wait for SageMaker response synchronously
// ✅ Start analysis, return immediately, poll for results
POST /api/start-analysis → returns fileId immediately
GET /api/analysis-status?fileId=... → poll every 5s
```

### 3. Database ID Mismatch
**Problem:** UUID generated for S3 key but Prisma auto-generates different ID  
**Solution:** Use same UUID for both S3 and database
```typescript
const id = crypto.randomUUID();
const key = `inference/${id}.mp4`;
await db.videoFile.create({
  data: { id: id, key: key, ... } // ← Pass explicit ID
});
```

### 4. JSON Parse Errors on Utterances
**Problem:** `JSON.parse("[object Object]")` error  
**Solution:** Prisma auto-parses JSON fields, don't parse again
```typescript
// ❌ Don't double-parse
emotions: JSON.parse(u.emotions)

// ✅ Use directly
emotions: u.emotions  // Already an object
```


## 📚 Credits & Acknowledgments

**Built following:**
- [Andreas Trolle's tutorial](https://www.youtube.com/watch?v=Myo5kizoSk0) - Train & Deploy Multimodal AI

**Datasets & Models:**
- [MELD Dataset](https://affective-meld.github.io/) - Multimodal EmotionLines Dataset (Friends TV series)
- Whisper (OpenAI) - Speech transcription
- RoBERTa (Hugging Face) - Emotion classification
- DistilBERT (Hugging Face) - Sentiment classification

**Technologies:**
- PyTorch & Hugging Face Transformers
- AWS SageMaker for GPU training & deployment
- Next.js & Vercel
- shadcn/ui components


**Built with ❤️ by [Your Name]**

#MachineLearning #SageMaker #NextJS #PyTorch #SaaS #BuildInPublic
