import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/register`;
    
    // Hacemos la petición al backend de NestJS desde el SERVIDOR de Next.js
    // Esto evita bloqueos de CORS, AdBlockers y problemas de red del celular
    const response = await axios.post(apiUrl, body, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('🚨 Error en Proxy de Registro:', error?.response?.data || error?.message);
    
    // Reenviar el error exacto al frontend
    const status = error?.response?.status || 500;
    const message = error?.response?.data?.message || error?.message || 'Error desconocido en el servidor proxy';
    
    return NextResponse.json(
      { message, error: 'ProxyError' },
      { status }
    );
  }
}
