export async function askGoaly(prompt: string): Promise<string> {
  if(!prompt.trim() || prompt.length>500)throw Error('Use 1 to 500 characters for your challenge.');
  const response=await fetch('/qvac/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({prompt}),signal:AbortSignal.timeout(35000)
  });
  const result=await response.json();
  if(!response.ok)throw Error(typeof result.error==='string'?result.error:'Goaly is unavailable. Try again.');
  if(typeof result.answer!=='string'||!result.answer.trim())throw Error('Goaly returned no usable reply.');
  return result.answer;
}
