function getServerApiBaseUrl(): string {
  const url =
    process.env.API_INTERNAL_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:3001";
  return url.replace("localhost", "127.0.0.1");
}

export const getLimit10Server = async () => {
  try {
    const res = await fetch(`${getServerApiBaseUrl()}/courts/featured`, {
      next: { revalidate: 60, tags: ['featured-courts'] },
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error('Failed to fetch featured courts');
    return await res.json();
  } catch (error) {
    console.error('Server API error:', error);
    return [];
  }
};

export const getAllClubsServer = async () => {
  try {
    const res = await fetch(`${getServerApiBaseUrl()}/clubs`, {
      next: { revalidate: 120, tags: ['clubs'] },
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error('Failed to fetch clubs');
    return await res.json();
  } catch (error) {
    console.error('Server API error fetching clubs:', error);
    return [];
  }
};
