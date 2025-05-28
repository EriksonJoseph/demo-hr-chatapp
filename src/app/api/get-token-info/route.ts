import { supabase } from '@/supabase'; // Adjusted path for supabase
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenId = searchParams.get('tokenId');

  if (!tokenId) {
    return NextResponse.json({ error: 'Token ID is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('tokens')
      .select('total_questions, questions')
      .eq('token_id', tokenId) // Assuming your token column is named 'token_id'
      .single();

    if (error) {
      console.error('Supabase error fetching token info:', error.message);
      // PGRST116 is the code for 'Fetched result not found'
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Token not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch token information', details: error.message }, { status: 500 });
    }

    if (!data) {
        // This case should ideally be caught by error.code === 'PGRST116' with .single()
        return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    return NextResponse.json({
      total_questions: data.total_questions,
      questions: data.questions
    });

  } catch (err: unknown) {
    let errorMessage = 'Unknown error';
    if (err && typeof err === 'object' && 'message' in err) {
      errorMessage = (err as { message?: string }).message || errorMessage;
    }
    console.error('API error fetching token info:', err);
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
  }
}
