import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(req: Request) {
  const { messages } = await req.json();

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 1024,
    messages,
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  return Response.json({ text });
}
