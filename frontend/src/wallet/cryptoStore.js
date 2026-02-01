function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveAesKey(password, salt, iterations = 150_000) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

const ACCOUNTS_INDEX_KEY = "nhom9_accounts_v1";
const VAULT_PREFIX = "nhom9_vault_v1:";

const LEGACY_SINGLE_WALLET_KEYS = [
  // Old single-wallet demo storage (pre accounts/vault).
  "nhom9_wallet_v1",
  // Some users may have renamed it while experimenting.
  "wallet_v1",
];

function normalizeUsername(username) {
  const u = (username || "").trim().toLowerCase();
  if (!u) throw new Error("Username trống.");
  if (!/^[a-z0-9_\-.]{3,32}$/.test(u)) {
    throw new Error("Username chỉ gồm a-z, 0-9, _.- và dài 3-32 ký tự.");
  }
  return u;
}

function loadAccountsIndex() {
  const raw = localStorage.getItem(ACCOUNTS_INDEX_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveAccountsIndex(usernames) {
  localStorage.setItem(ACCOUNTS_INDEX_KEY, JSON.stringify([...new Set(usernames)].sort()));
}

function vaultStorageKey(username) {
  return `${VAULT_PREFIX}${normalizeUsername(username)}`;
}

async function encryptJson({ value, password }) {
  if (!crypto?.subtle) throw new Error("Trình duyệt không hỗ trợ WebCrypto (crypto.subtle).");
  if (!password) throw new Error("Password trống.");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);

  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
  );

  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iter: 150000,
    cipher: "AES-GCM-256",
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext),
  };
}

async function decryptJson({ payload, password }) {
  if (!crypto?.subtle) throw new Error("Trình duyệt không hỗ trợ WebCrypto (crypto.subtle).");
  if (!password) throw new Error("Password trống.");
  if (!payload?.salt || !payload?.iv || !payload?.data) {
    throw new Error("Dữ liệu bị thiếu trường cần thiết.");
  }

  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.data);
  const key = await deriveAesKey(password, salt, payload.iter || 150000);

  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  } catch {
    throw new Error("Sai mật khẩu hoặc dữ liệu bị hỏng.");
  }

  const dec = new TextDecoder();
  const text = dec.decode(plaintext);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Dữ liệu bị lỗi (không parse được).");
  }
}

export function listLocalAccounts() {
  return loadAccountsIndex();
}

export function clearLegacyData() {
  let removed = 0;
  for (const key of LEGACY_SINGLE_WALLET_KEYS) {
    if (localStorage.getItem(key) != null) {
      localStorage.removeItem(key);
      removed += 1;
    }
  }
  return removed;
}

export function clearAllLocalData() {
  // Removes ONLY this app's known localStorage keys (accounts + vaults + legacy).
  // Does not call localStorage.clear() to avoid wiping unrelated site data.
  const accountIndexKeys = ["nhom9_accounts_v1", "accounts_v1"];
  const vaultPrefixes = ["nhom9_vault_v1:", "vault_v1:"];

  let removed = 0;

  // Remove account indexes.
  for (const k of accountIndexKeys) {
    if (localStorage.getItem(k) != null) {
      localStorage.removeItem(k);
      removed += 1;
    }
  }

  // Remove all vault entries by prefix.
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (vaultPrefixes.some((p) => key.startsWith(p))) keysToRemove.push(key);
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
    removed += 1;
  }

  removed += clearLegacyData();
  return removed;
}

export function hasAccount(username) {
  try {
    return Boolean(localStorage.getItem(vaultStorageKey(username)));
  } catch {
    return false;
  }
}

export async function createAccount({ username, password }) {
  const u = normalizeUsername(username);
  if (!password || password.length < 8) throw new Error("Mật khẩu tối thiểu 8 ký tự.");
  const key = vaultStorageKey(u);
  if (localStorage.getItem(key)) throw new Error("Account đã tồn tại trên máy.");

  const emptyVault = {
    v: 1,
    createdAt: Date.now(),
    wallets: [],
    selectedWalletId: null,
  };

  const encrypted = await encryptJson({ value: emptyVault, password });
  localStorage.setItem(key, JSON.stringify(encrypted));

  const idx = loadAccountsIndex();
  idx.push(u);
  saveAccountsIndex(idx);

  return u;
}

export async function loadVault({ username, password }) {
  const key = vaultStorageKey(username);
  const raw = localStorage.getItem(key);
  if (!raw) throw new Error("Account không tồn tại trên máy.");

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("Dữ liệu vault bị lỗi (không parse được).");
  }

  const vault = await decryptJson({ payload, password });
  if (!vault || typeof vault !== "object" || vault.v !== 1 || !Array.isArray(vault.wallets)) {
    throw new Error("Vault không hợp lệ hoặc sai phiên bản.");
  }
  return vault;
}

export async function saveVault({ username, password, vault }) {
  const key = vaultStorageKey(username);
  const encrypted = await encryptJson({ value: vault, password });
  localStorage.setItem(key, JSON.stringify(encrypted));
}

export function deleteAccount(username) {
  const u = normalizeUsername(username);
  localStorage.removeItem(vaultStorageKey(u));
  const idx = loadAccountsIndex().filter((x) => x !== u);
  saveAccountsIndex(idx);
}

export function exportAccountBackup(username) {
  const u = normalizeUsername(username);
  const key = vaultStorageKey(u);
  const raw = localStorage.getItem(key);
  if (!raw) throw new Error("Account không tồn tại trên máy.");

  let encryptedVault;
  try {
    encryptedVault = JSON.parse(raw);
  } catch {
    throw new Error("Dữ liệu vault bị lỗi (không parse được).");
  }

  if (!encryptedVault?.salt || !encryptedVault?.iv || !encryptedVault?.data) {
    throw new Error("Vault không hợp lệ hoặc thiếu trường.");
  }

  return {
    type: "vault_backup_v1",
    exportedAt: Date.now(),
    username: u,
    encryptedVault,
  };
}

export function importAccountBackup({ backup, overwrite = false }) {
  if (!backup || typeof backup !== "object") throw new Error("Backup không hợp lệ.");

  // Backward compatible with an older type name.
  if (backup.type !== "vault_backup_v1" && backup.type !== "nhom9_vault_backup_v1") {
    throw new Error("Sai định dạng backup.");
  }

  const u = normalizeUsername(backup.username);
  const encryptedVault = backup.encryptedVault;
  if (!encryptedVault?.salt || !encryptedVault?.iv || !encryptedVault?.data) {
    throw new Error("Backup thiếu dữ liệu encryptedVault.");
  }

  const key = vaultStorageKey(u);
  if (!overwrite && localStorage.getItem(key)) {
    throw new Error("Account đã tồn tại. Bật overwrite để ghi đè.");
  }

  localStorage.setItem(key, JSON.stringify(encryptedVault));

  const idx = loadAccountsIndex();
  idx.push(u);
  saveAccountsIndex(idx);

  return u;
}
