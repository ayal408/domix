export function mapUser(user, token) {
  return {
    userId: user.userId,
    userName: user.userName,
    email: user.emailAddress ?? null,
    phone: user.phoneNumber ?? null,
    googleId: user.googleId ?? null,
    registrationMethod: user.registrationMethod,
    profileImageBase64: user.profileImageBase64 ?? null,
    isEmailVerified: user.isEmailVerified ?? false,
    token
  };
}
