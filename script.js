document.addEventListener("DOMContentLoaded", () => {
    const submitBtn = document.getElementById("submit-btn");
    const userInput = document.getElementById("user-input");
    const responseDiv = document.getElementById("response");

    if (submitBtn) {
        submitBtn.addEventListener("click", async () => {
            const question = userInput.value.trim();
            if (question) {
                responseDiv.textContent = "Die KI denkt nach...";
                try {
                    const response = await fetch("https://api.openai.com/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": "Bearer DEIN_OPENAI_API_KEY"
                        },
                        body: JSON.stringify({
                            model: "gpt-3.5-turbo",
                            messages: [{ role: "user", content: question }]
                        })
                    });
                    const data = await response.json();
                    responseDiv.textContent = data.choices[0].message.content;
                } catch (error) {
                    responseDiv.textContent = "Es ist ein Fehler aufgetreten.";
                }
            }
        });
    }
});
