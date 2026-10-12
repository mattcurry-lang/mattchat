// src/components/ConnectedApps/connectedAppsData.js
// Each app opens its own official site/app via a normal https link.
// On phones with the app installed, universal links open the app itself.
// To add an app: append one object. `domain` is used to fetch the logo.

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'social', label: 'Social' },
  { id: 'video', label: 'Video' },
  { id: 'music', label: 'Music' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'work', label: 'Work' },
  { id: 'learn', label: 'Learn' },
  { id: 'money', label: 'Money' },
  { id: 'campus', label: 'Campus' },
];

export const APPS = [
  // Social
  { id: 'tiktok', name: 'TikTok', category: 'social', url: 'https://www.tiktok.com/', domain: 'tiktok.com', color: '#fe2c55' },
  { id: 'instagram', name: 'Instagram', category: 'social', url: 'https://www.instagram.com/', domain: 'instagram.com', color: '#e1306c' },
  { id: 'x', name: 'X', category: 'social', url: 'https://x.com/', domain: 'x.com', color: '#111111' },
  { id: 'facebook', name: 'Facebook', category: 'social', url: 'https://www.facebook.com/', domain: 'facebook.com', color: '#1877f2' },
  { id: 'snapchat', name: 'Snapchat', category: 'social', url: 'https://www.snapchat.com/', domain: 'snapchat.com', color: '#fffc00' },
  { id: 'linkedin', name: 'LinkedIn', category: 'social', url: 'https://www.linkedin.com/', domain: 'linkedin.com', color: '#0a66c2' },
  { id: 'reddit', name: 'Reddit', category: 'social', url: 'https://www.reddit.com/', domain: 'reddit.com', color: '#ff4500' },

  // Video
  { id: 'youtube', name: 'YouTube', category: 'video', url: 'https://www.youtube.com/', domain: 'youtube.com', color: '#ff0000' },
  { id: 'netflix', name: 'Netflix', category: 'video', url: 'https://www.netflix.com/', domain: 'netflix.com', color: '#e50914' },
  { id: 'twitch', name: 'Twitch', category: 'video', url: 'https://www.twitch.tv/', domain: 'twitch.tv', color: '#9146ff' },

  // Music
  { id: 'spotify', name: 'Spotify', category: 'music', url: 'https://open.spotify.com/', domain: 'spotify.com', color: '#1db954' },
  { id: 'applemusic', name: 'Apple Music', category: 'music', url: 'https://music.apple.com/', domain: 'music.apple.com', color: '#fa243c' },
  { id: 'audiomack', name: 'Audiomack', category: 'music', url: 'https://audiomack.com/', domain: 'audiomack.com', color: '#ffa200' },
  { id: 'boomplay', name: 'Boomplay', category: 'music', url: 'https://www.boomplay.com/', domain: 'boomplay.com', color: '#0a8cf0' },

  // Messaging
  { id: 'whatsapp', name: 'WhatsApp', category: 'messaging', url: 'https://web.whatsapp.com/', domain: 'whatsapp.com', color: '#25d366' },
  { id: 'telegram', name: 'Telegram', category: 'messaging', url: 'https://web.telegram.org/', domain: 'telegram.org', color: '#26a5e4' },
  { id: 'discord', name: 'Discord', category: 'messaging', url: 'https://discord.com/app', domain: 'discord.com', color: '#5865f2' },

  // Work
  { id: 'gmail', name: 'Gmail', category: 'work', url: 'https://mail.google.com/', domain: 'mail.google.com', color: '#ea4335' },
  { id: 'gdrive', name: 'Drive', category: 'work', url: 'https://drive.google.com/', domain: 'drive.google.com', color: '#1fa463' },
  { id: 'gmeet', name: 'Meet', category: 'work', url: 'https://meet.google.com/', domain: 'meet.google.com', color: '#00897b' },
  { id: 'notion', name: 'Notion', category: 'work', url: 'https://www.notion.so/', domain: 'notion.so', color: '#111111' },
  { id: 'github', name: 'GitHub', category: 'work', url: 'https://github.com/', domain: 'github.com', color: '#24292f' },
  { id: 'canva', name: 'Canva', category: 'work', url: 'https://www.canva.com/', domain: 'canva.com', color: '#00c4cc' },

  // Learn
  { id: 'coursera', name: 'Coursera', category: 'learn', url: 'https://www.coursera.org/', domain: 'coursera.org', color: '#0056d2' },
  { id: 'khan', name: 'Khan Academy', category: 'learn', url: 'https://www.khanacademy.org/', domain: 'khanacademy.org', color: '#14bf96' },
  { id: 'wikipedia', name: 'Wikipedia', category: 'learn', url: 'https://www.wikipedia.org/', domain: 'wikipedia.org', color: '#444444' },

  // Money
  { id: 'mpesa', name: 'M-Pesa', category: 'money', url: 'https://www.safaricom.co.ke/', domain: 'safaricom.co.ke', color: '#4cb848' },
  { id: 'ecitizen', name: 'eCitizen', category: 'money', url: 'https://www.ecitizen.go.ke/', domain: 'ecitizen.go.ke', color: '#b5121b' },

  // Campus
  { id: 'dekut', name: 'DeKUT', category: 'campus', url: 'https://www.dkut.ac.ke/', domain: 'dkut.ac.ke', color: '#7c3aed' },
];
