import db from "@/lib/db";

type GoogleUser = {
  googleId: string;
  name: string;
  email: string;
  image: string;
};

export function saveGoogleUser(user: GoogleUser) {
  db.prepare(`
    INSERT INTO users (google_id, name, email, image)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(google_id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      image = excluded.image
  `).run(user.googleId, user.name, user.email, user.image);
}

export function hasGoogleUser(googleId: string) {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE google_id = ?").get(googleId));
}

export function getGoogleIdByEmail(email: string) {
  const users = db
    .prepare("SELECT google_id FROM users WHERE email = ? COLLATE NOCASE LIMIT 2")
    .all(email) as { google_id: string }[];

  return users.length === 1 ? users[0].google_id : undefined;
}
