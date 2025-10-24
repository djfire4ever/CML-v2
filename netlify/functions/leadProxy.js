export async function handler(event) {
    const url = "https://script.google.com/macros/s/AKfycbz0n1Br3EO0z7Dukhqo0bZ_QKCZ-3hLjjsLdZye6kBPdu7Wdl7ag9dTBbgiJ5ArrCQ/exec";
  
    try {
      const isGet = event.httpMethod === "GET";
      const isPost = event.httpMethod === "POST";
  
      const options = {
        method: event.httpMethod,
        headers: {
          "Content-Type": "application/json"
        },
        ...(isPost && { body: event.body })
      };
  
      const query = event.rawUrl.split("/.netlify/functions/leadProxy")[1] || "";
      const fullURL = isGet ? `${url}${query}` : url;
  
      const res = await fetch(fullURL, options);
      const text = await res.text();
  
      return {
        statusCode: res.status,
        body: text,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  }
  