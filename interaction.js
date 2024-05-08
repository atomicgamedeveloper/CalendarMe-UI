let fs = require('fs');
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

const CHAT_WINDOW_STATES = {
    CREATE: 'Create',
    SPECIFY: 'Specify',
};

class ChatWindow {
    #messages = [];
    #USER = "user";
    #ASSISTANT = "assistant";
    #SYSTEM = "system";
    #STATE = CHAT_WINDOW_STATES.CREATE;

    constructor(model = GPT3_5, systemPrompt = defaultSystemPrompt) {
        if (model != GPT4 && model != GPT3_5) {
            throw new Error(`Model '${model}' is not supported.`)
        }
        this.model = model;
        const systemMessage = this.#makeMessage(this.#SYSTEM, systemPrompt);
        this.#messagesAppend(systemMessage);
    }

    getState() {
        return this.#STATE;
    }

    setState(state) {
        if (state != CHAT_WINDOW_STATES.CREATE && state != CHAT_WINDOW_STATES.SPECIFY) {
            throw new Error(`State '${model}' does not exist.`)
        }
        this.#STATE = state;
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
            //'response_format': { 'type': 'json_object' },
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
        newParagraph.innerHTML = message.role + ":\n\n"
        newParagraph.innerHTML += message.content;
        chatHistory.appendChild(newParagraph);
        chatHistory.scrollTo({ top: chatHistory.scrollHeight });
    }

    #parseJSONToObject(jsonString) {
        try {
            let obj = JSON.parse(jsonString);
            return obj;
        } catch (e) {
            // Log error or handle it as needed
            console.error('Error parsing JSON', e);
            return null; // or return an empty object {}, based on your needs
        }
    }

    #generateMessageHTMLStreamed(message) {
        return new Promise((resolve) => {
            let newParagraph = document.createElement("p");
            newParagraph.innerHTML = `<strong>${message.role}</strong>:<br>`;
            chatHistory.appendChild(newParagraph);

            let index = 0;
            function typeMessage() {
                if (index < message.content.length) {
                    let chunkSize = Math.floor(Math.random() * 4) + 2; // 2-3 characters
                    let part = message.content.slice(index, index + chunkSize);
                    newParagraph.innerHTML += part;
                    index += chunkSize;

                    chatHistory.scrollTo({ top: chatHistory.scrollHeight });
                    setTimeout(typeMessage, Math.random() * 100 + 100);
                } else {
                    resolve();
                }
            }
            typeMessage();
        });
    }

    getMessages() {
        return this.#messages;
    }

    sendUserMessage(prompt) {
        let userMessage = this.#makeMessage(this.#USER, prompt);
        this.#messagesAppend(userMessage);
        this.#generateMessageHTML(userMessage);
        let messages = this.getMessages();
        let emptyResponseMessage = this.#makeMessage(this.#ASSISTANT, "");
        this.#generateMessageHTML(emptyResponseMessage);
        this.#streamResponse(messages);
    }

    async sendSystemMessage(prompt) {
        let systemMessage = this.#makeMessage(this.#SYSTEM, prompt);
        await this.#generateMessageHTMLStreamed(systemMessage);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const chatWindow = new ChatWindow(GPT4);
(async () => {
    await chatWindow.sendSystemMessage("Welcome to CalendarMe!");
    await sleep(1000);
    await chatWindow.sendSystemMessage("Please write your plans here in as much detail as you like.")
})();

textInputBox.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        let today = new Date().toISOString().split('T')[0];
        let time = new Date().toTimeString().split(' ')[0];
        let day = new Date().toLocaleString('en-us', { weekday: 'long' });
        let textFromInputBox = textInputBox.value;
        let planning_prompt = textFromInputBox;

        textInputBox.value = "";

        let constructedPrompt = planning_prompt//`Given the following current date and time: ${day}, ${today}T${time} and planning prompt: '${planning_prompt}', format the prompt's contents as JSON objects with the following keys: summary, location (Optional.), description, start, end, recurrence (Optional. array of RRULE strings), reminders (Optional. useDefault, overrides), timeZone (Etc/GMT+2), allDay (boolean), in an array that can be parsed to create calendar events. Please use 1-2 emojis per complex sentence in the title's lhs and description to make them more personal.`;

        if (chatWindow.getState() == CHAT_WINDOW_STATES.CREATE) {
            constructedPrompt = `Given the following current date and time: ${day}, ${today}T${time} and planning prompt: '${planning_prompt}', format the prompt's contents as JSON objects with the following keys: summary, location (Optional.), description, start, end, recurrence (Optional. array of RRULE strings), reminders (Optional. useDefault, overrides), timeZone (Etc/GMT+2), allDay (Optional. boolean), in an array that can be parsed to create calendar events. Please use 1-2 emojis per complex sentence in the title's lhs and description to make them more personal.`;
            chatWindow.setState(CHAT_WINDOW_STATES.SPECIFY);
        }
        chatWindow.sendUserMessage(constructedPrompt);
    }
});