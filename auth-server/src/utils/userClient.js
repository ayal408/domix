import axios from "axios";

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || "https://apartment-brokerage-wkfs.onrender.com";

export async function lookupUser(params) {
  try {
    const { data } = await axios.get(`${DATA_SERVICE_URL}/api/User/lookup`, {
      params
    });
    return data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

export async function createUser(payload) {
  const { data } = await axios.post(`${DATA_SERVICE_URL}/api/User`, payload);
  return data;
}

export async function linkGoogle(userId, googleId) {
  const { data } = await axios.put(`${DATA_SERVICE_URL}/api/User/link-google`, {
    userId,
    googleId
  });
  return data;
}

export async function linkPassword(userId, passwordHash, userName) {
  const { data } = await axios.put(`${DATA_SERVICE_URL}/api/User/link-password`, {
    userId,
    passwordHash,
    userName
  });
  return data;
}
