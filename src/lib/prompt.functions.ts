import { createServerFn } from "@tanstack/react-start";
import { createOpenRouterText } from "@tanstack/ai-openrouter";


export const promptDiff = createServerFn({ method: 'POST' }).validator((data: { markdown: string, prompt: string }) => data).handler((data) => {
  //  const adapter = createOpenRouterText("z-ai/glm-5.3-flash", process.env.OPENROUTER_API_KEY!);


})
