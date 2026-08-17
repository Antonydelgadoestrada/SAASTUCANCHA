import axios from "axios";

function getServerApiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3001"
  );
}

// API client para Server Components (no usa localStorage ni next-auth)
const serverApi = axios.create({
  baseURL: getServerApiBaseUrl(),
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getLimit10Server = async () => {
  try {
    const result = await serverApi.get("/courts/featured");
    return result.data;
  } catch (error) {
    console.error('Server API error:', error);
    return [];
  }
};
