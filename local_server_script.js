
/* 
  [IKAVA VetPulse - Local Image Server for Synology]
  
  이 파일은 Synology NAS의 Node.js 환경에서 실행하기 위한 서버 스크립트입니다.
  실행 방법:
  1. 시놀로지 패키지 센터에서 'Node.js' 설치
  2. 제어판 -> 작업 스케줄러에서 이 스크립트를 '사용자 정의 스크립트'로 등록하거나 Docker로 실행
  3. 포트 3000번이 방화벽에서 열려 있는지 확인하세요.
*/

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');

// --- 설정 ---
const PORT = 3000;
const IP_ADDRESS = '0.0.0.0'; 
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// 업로드 폴더 자동 생성
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const app = express();

// CORS 설정: 모든 Origin 허용
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// 정적 파일 제공 (이미지 조회용) - 개별 라우트에도 CORS 적용
app.use('/uploads', cors(corsOptions), express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Multer 설정 (이미지 저장)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E4);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 최대 10MB
});

// 업로드 라우트
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const protocol = req.secure ? 'https' : 'http';
  const host = req.get('host'); 
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

  console.log(`[Image Saved Success] ${req.file.filename} -> ${fileUrl}`);
  res.json({ url: fileUrl });
});

app.get('/', (req, res) => {
  res.send('IKAVA Local Image Server is running.');
});

// --- 서버 실행 ---

const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  try {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    https.createServer(httpsOptions, app).listen(PORT, IP_ADDRESS, () => {
      console.log(`✅ Secure Local Image Server: https://[NAS_IP]:${PORT}`);
    });
  } catch (e) {
    console.error("❌ HTTPS Start failed, check your cert.pem/key.pem files.", e);
  }
} else {
  console.warn('⚠️ WARNING: SSL Certificates not found. Starting in HTTP mode.');
  app.listen(PORT, IP_ADDRESS, () => {
    console.log(`🚀 Local Image Server: http://[NAS_IP]:${PORT}`);
  });
}
