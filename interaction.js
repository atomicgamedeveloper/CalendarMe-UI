const fs = require('fs');
const OpenAI = require('openai');
let openAIKey = "";

try {
    openAIKey = fs.readFileSync('openai.txt', 'utf8')
} catch (err) {
    console.error('Error reading file:', err);
}

const openai = new OpenAI({
    apiKey: openAIKey,
    dangerouslyAllowBrowser: true,
})

let textInputBox = document.getElementById('text-input-box')
let chatHistory = document.getElementById('chat-history')
const defaultSystemPrompt = "You are a helpful chatbot.";
const GPT4 = "gpt-4-turbo-preview";
const GPT3_5 = 'gpt-3.5-turbo-0125';

class ChatWindow {
    #messages = [];
    #USER = "user";
    #ASSISTANT = "assistant";
    #SYSTEM = "system";

    constructor(model = GPT3_5, systemPrompt = defaultSystemPrompt) {
        if (model != GPT4 && model != GPT3_5) {
            throw new Error(`Model '${model}' is not supported.`)
        }
        this.model = model;
        const systemMessage = this.#makeMessage(this.#SYSTEM, systemPrompt);
        this.#messagesAppend(systemMessage);
    }

    #makeMessage(role, message) {
        if (role != this.#USER && role != this.#ASSISTANT && role != this.#SYSTEM) {
            throw new Error(`Role '${role}' is not a valid role.`)
        }
        return { "role": role, "content": message };
    }

    #messagesAppend(message) {
        this.#messages.push(message);
    }

    async #streamResponse(messages) {
        let stream = await openai.chat.completions.create({
            'model': this.model,
            'messages': messages,
            'stream': true
        });

        let initialResponeHTML = this.#getLastMessageElement();
        let response = "";
        for await (const chunk of stream) {
            let newText = chunk.choices[0]?.delta?.content || '';
            response += newText;
            initialResponeHTML.innerHTML += newText;
        }

        let responseMessage = this.#makeMessage(this.#USER, response);
        this.#messagesAppend(responseMessage);
    }

    #getLastMessageElement() {
        return chatHistory.lastElementChild;
    }

    #generateMessageHTML(message) {
        let newParagraph = document.createElement('p');
        newParagraph.innerHTML = message.role + ":\n" + message.content;
        chatHistory.appendChild(newParagraph);
        chatHistory.scrollTo({ top: chatHistory.scrollHeight });
    }

    getMessages() {
        return this.#messages;
    }

    sendMessage(prompt) {
        let userMessage = this.#makeMessage(this.#USER, prompt);
        this.#messagesAppend(userMessage);
        this.#generateMessageHTML(userMessage);
        let messages = this.getMessages();
        let emptyResponseMessage = this.#makeMessage(this.#ASSISTANT, "");
        this.#generateMessageHTML(emptyResponseMessage);
        this.#streamResponse(messages);
    }
}

const chatWindow = new ChatWindow(GPT3_5);

textInputBox.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        let textFromInputBox = textInputBox.value;
        textInputBox.value = "";
        chatWindow.sendMessage(textFromInputBox);
    } else {
        console.log('the ship ain\'t shippin\'');
    }
});