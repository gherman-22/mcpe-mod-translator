const https = require('https');
const fs = require('fs');
const path = require('path');

const scenes = [
  {
    id: 'scene1',
    title: 'Giới Thiệu MCPE Mod Translator',
    text: 'Chào mừng các bạn đến với MCPE Mod Translator, công cụ tự động dịch toàn diện dành cho Mod, Addon và Menu Minecraft Bedrock. Ứng dụng giúp bạn chuyển đổi ngôn ngữ mọi bản mod sang tiếng Việt chỉ với một cú nhấp chuột.'
  },
  {
    id: 'scene2',
    title: 'Cảnh AI Xây Dựng Hệ Thống',
    text: 'Hệ thống được AI kiến tạo từ nền tảng Node.js và Express. AI đã tự động xây dựng các bộ phân tích cú pháp nâng cao: bóc tách file lang, quét AST giao diện menu JavaScript Bedrock Script API, phân tích JSON UI và cấu hình luồng truyền dữ liệu thời gian thực Server-Sent Events cực kỳ mượt mà.'
  },
  {
    id: 'scene3',
    title: 'Tính Năng Dịch Toàn Diện',
    text: 'Ứng dụng hỗ trợ trọn gói các định dạng mcpack, mcaddon và file zip. Điểm đặc biệt là khả năng dịch chính xác menu JavaScript, tin nhắn chat và giao diện tùy chỉnh, đồng thời bảo tồn một trăm phần trăm các mã màu Minecraft và biến định dạng, đảm bảo mod vận hành trơn tru không lỗi.'
  },
  {
    id: 'scene4',
    title: 'Tài Khoản, VIP Key và Vượt Link',
    text: 'Hệ thống trang bị tính năng tài khoản bảo mật bằng JWT và Cookie an toàn. Người dùng có thể nâng cấp VIP với key cộng dồn thời hạn ba mươi ngày để dịch không giới hạn, hoặc mở khóa dịch miễn phí thông qua cổng vượt link kiểm tra an toàn tại máy chủ.'
  },
  {
    id: 'scene5',
    title: 'Quy Trình Hoạt Động & Chỉnh Sửa Trực Tiếp',
    text: 'Quy trình sử dụng vô cùng đơn giản: Kéo thả file mod vào trang web, theo dõi tiến trình dịch trực tiếp theo thời gian thực. Đặc biệt, bạn có thể nhấp chuột trực tiếp vào từng dòng trong bảng xem trước để chỉnh sửa theo ý muốn trước khi tải về file mod hoàn chỉnh.'
  },
  {
    id: 'scene6',
    title: 'Khởi Động 1-Click & Lời Kết',
    text: 'Để bắt đầu, bạn chỉ cần nhấp đúp vào file start.bat để khởi chạy ứng dụng trên cổng tám mươi tám mươi. Hãy trải nghiệm ngay MCPE Mod Translator để mang những bản mod tuyệt vời nhất về với cộng đồng Minecraft Việt Nam!'
  }
];

async function fetchChunk(text) {
  return new Promise((resolve, reject) => {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(text) + '&tl=vi&client=tw-ob';
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP status ' + res.statusCode));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function splitIntoChunks(text, maxLen = 160) {
  const sentences = text.match(/[^,.;:]+[,.;:]*/g) || [text];
  const chunks = [];
  let current = '';

  for (let s of sentences) {
    s = s.trim();
    if (!s) continue;
    if ((current + ' ' + s).trim().length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = s;
    } else {
      current = (current + ' ' + s).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function generateAll() {
  const outDir = path.join(__dirname, 'public', 'video_assets', 'audio');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Generating voiceover audio files for video presentation...');

  for (const scene of scenes) {
    console.log(`\nProcessing ${scene.id}: "${scene.title}"`);
    const chunks = splitIntoChunks(scene.text);
    console.log(`- Splitting into ${chunks.length} parts`);

    const buffers = [];
    for (let i = 0; i < chunks.length; i++) {
      const part = chunks[i];
      console.log(`  [${i+1}/${chunks.length}] Fetching audio: "${part.substring(0, 40)}..."`);
      try {
        const buf = await fetchChunk(part);
        buffers.push(buf);
        // Small delay to be polite
        await new Promise(r => setTimeout(r, 400));
      } catch (err) {
        console.error(`  Error fetching chunk ${i}:`, err.message);
      }
    }

    const fullAudio = Buffer.concat(buffers);
    const filePath = path.join(outDir, `${scene.id}.mp3`);
    fs.writeFileSync(filePath, fullAudio);
    console.log(`✓ Saved ${scene.id}.mp3 (${fullAudio.length} bytes)`);
  }

  // Also save a manifest metadata file for the video player
  const manifest = {
    generatedAt: new Date().toISOString(),
    scenes: scenes.map(s => ({
      id: s.id,
      title: s.title,
      text: s.text,
      audioFile: `video_assets/audio/${s.id}.mp3`
    }))
  };

  fs.writeFileSync(
    path.join(__dirname, 'public', 'video_assets', 'scenes.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  console.log('\n✓ All voiceover tracks generated and scenes.json saved!');
}

generateAll().catch(e => {
  console.error('Fatal error generating audio:', e);
});
