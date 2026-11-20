import { auth } from "@/auth";
import { getGoogleIdByEmail, hasGoogleUser, saveGoogleUser } from "@/lib/google-users";

export async function getCurrentGoogleId() {
  const session = await auth();
  const user = session?.user;
  if (!user) return null;

  let googleId = user.googleId;

  if (googleId && user.name && user.email && user.image) {
    saveGoogleUser({
      googleId,
      name: user.name,
      email: user.email,
      image: user.image,
    });
    return googleId;
  }

  if (googleId && hasGoogleUser(googleId)) return googleId;

  if (user.email) {
    googleId = getGoogleIdByEmail(user.email);
    if (googleId) {
      if (user.name && user.email && user.image) {
        saveGoogleUser({
          googleId,
          name: user.name,
          email: user.email,
          image: user.image,
        });
      }
      return googleId;
    }
  }

  return null;
}
