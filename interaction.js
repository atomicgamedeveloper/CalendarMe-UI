let fs = require('fs');
const OpenAI = require('openai');
const calendarjs = require('./calendar.js');

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

let calendarId = 'primary';
let options;

const dropdownBtn = document.getElementById('dropdownBtn');
const dropdownContent = document.getElementById('dropdownContent');

(async () => {
    const auth = await calendarjs.authorize();
    calendars = await calendarjs.getCalendars(auth);
    calendars.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.textContent = option.summary;
        optionDiv.addEventListener('click', () => {
            calendarId = option.id;
            dropdownBtn.textContent = option.summary;
            dropdownContent.classList.remove('show');
        });
        dropdownContent.appendChild(optionDiv);
    });
})();

dropdownBtn.addEventListener('click', () => {
    dropdownContent.classList.toggle('show');
});

window.addEventListener('click', (e) => {
    if (!dropdownBtn.contains(e.target)) {
        dropdownContent.classList.remove('show');
    }
});

dropdownBtn.textContent = "primary";
model = dropdownBtn.textContent;

const defaultSystemPrompt = "You are an event manager AI named CalendarMe who creates events with inspired emoji-choices, memorable summaries and informative, helpful descriptions. Opt to be creative rather than copying directly what the user says.";
const GPT4o = "gpt-4o";
const GPT4 = "gpt-4-turbo-preview";
const GPT3_5 = 'gpt-3.5-turbo-0125';

const CHAT_WINDOW_STATES = {
    CREATE: 'Create',
    SPECIFY: 'Specify'
};

class ChatWindow {
    #messages = [];
    #USER = "user";
    #ASSISTANT = "assistant";
    #SYSTEM = "system";
    #STATE = CHAT_WINDOW_STATES.CREATE;

    constructor(model = GPT3_5, systemPrompt = defaultSystemPrompt) {
        if (model != GPT4 && model != GPT3_5 && model != GPT4o) {
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
            'messages': messages,
            'stream': true,
            'temperature': 1
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
        newParagraph.innerHTML = `<strong>${message.role}</strong>:<br>`
        newParagraph.innerHTML += message.content;
        chatHistory.appendChild(newParagraph);
        chatHistory.scrollTo({ top: chatHistory.scrollHeight });
    }

    async #extractAndParseJSON(jsonString) {
        const normalizedJSONString = this.#extractJSONFromString(jsonString);
        return await this.#parseJSONToObject(normalizedJSONString);
    }

    #extractJSONFromString(text) {
        const jsonPattern = /```json\s*([\s\S]*?)\s*```/; // Corrected regex pattern// Regex to extract content between ```json and ```
        const matches = jsonPattern.exec(text);

        if (matches && matches[1]) {
            console.log(matches[1]);
            return matches[1]; // Returns the extracted JSON string
        } else {
            console.error('No JSON found in the string');
            return null;
        }
    }

    async #parseJSONToObject(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            const fixedJsonPrompt = `This JSON array: '${jsonString}'\n\n` +
                `gives this error:\n'${e}'.\nplease fix it.`;

            await this.sendUserMessage(fixedJsonPrompt);

            const fixedJsonMessage = this.#messages.slice(-1)[0].content;
            console.log(`Fixed JSON: ${fixedJsonMessage}`);

            const fixedJsonString = this.#extractJSONFromString(fixedJsonMessage);

            try {
                return JSON.parse(fixedJsonString);
            } catch (error) {
                console.error('Error parsing JSON', error);
                return null;
            }
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
                    setTimeout(typeMessage, Math.random() * 50 + 80);
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

    clearMessages() {
        this.#messages = [];
    }

    #makeNewEventsPrompt(prompt) {
        let today = new Date().toISOString().split('T')[0];
        let time = new Date().toTimeString().split(' ')[0];
        let day = new Date().toLocaleString('en-us', { weekday: 'long' });
        let newEventsPrompt = `Given the following current date and time: ${day}, ${today}T${time}:00 and planning prompt: '${prompt}', format the prompt's contents as JSON objects with the following keys: summary, description (short, in 2nd person and timeless), start, end (don't write timezone.), allDay (boolean), color (hex, only if asked for), and location (if provided) in an array that can be parsed to create calendar events. Please use 1-2 emojis per complex sentence in the title's lhs and description to make them more personal.`;
        return newEventsPrompt;
    }

    async sendUserMessage(prompt) {
        let userMessage = this.#makeMessage(this.#USER, prompt);
        this.#generateMessageHTML(userMessage);
        switch (this.#STATE) {
            case CHAT_WINDOW_STATES.CREATE:
                let newEventsPrompt = this.#makeNewEventsPrompt(prompt)
                let newEventsMessage = this.#makeMessage(this.#USER, newEventsPrompt);
                this.#messagesAppend(newEventsMessage);
                let messages = this.getMessages();
                let emptyResponseMessage = this.#makeMessage(this.#ASSISTANT, "");
                this.#generateMessageHTML(emptyResponseMessage);
                await this.#streamResponse(messages);

                this.setState(CHAT_WINDOW_STATES.SPECIFY);
                await this.sendSystemMessage("Is this event ok, then write \"yes\" to confirm.");
                break;
            case CHAT_WINDOW_STATES.SPECIFY:
                let normalizedPrompt = prompt.trim().toLowerCase();
                if (normalizedPrompt === "exit") {
                    this.setState(CHAT_WINDOW_STATES.CREATE);
                    this.clearMessages();
                    await this.sendSystemMessage("Please write your plans here in as much detail as you like.");
                } else if (normalizedPrompt === "yes") {
                    let messages = this.getMessages();
                    let events_message = messages.slice(-1)[0].content;
                    let events_json = await this.#extractAndParseJSON(events_message);
                    let eventsToProcess = Array.isArray(events_json) ? events_json : [events_json];
                    let events = calendarjs.createEventObjects(eventsToProcess);
                    try {
                        const auth = await calendarjs.authorize();
                        await calendarjs.createEvents(auth, events, calendarId);
                        let summaryList = events.map(event => event.summary).join(', ');
                        await this.sendSystemMessage(`Events '${summaryList}' created!`);
                    } catch (error) {
                        console.error(error);
                        await this.sendSystemMessage(`Events failed to be made!`);
                    }

                    this.setState(CHAT_WINDOW_STATES.CREATE);
                    await this.sendSystemMessage("Please write your plans here in as much detail as you like.");
                    this.clearMessages();
                } else {
                    this.#messagesAppend(userMessage);
                    let messages = this.getMessages();
                    let emptyResponseMessage = this.#makeMessage(this.#ASSISTANT, "");
                    this.#generateMessageHTML(emptyResponseMessage);
                    await this.#streamResponse(messages);
                    await this.sendSystemMessage("Is this event ok, then write \"yes\" to confirm.");
                }
            default:
                break;
        }
    }

    async sendSystemMessage(prompt) {
        let systemMessage = this.#makeMessage(this.#SYSTEM, prompt);
        await this.#generateMessageHTMLStreamed(systemMessage);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const chatWindow = new ChatWindow(GPT4o);
(async () => {
    await chatWindow.sendSystemMessage("Welcome to CalendarMe!");
    await sleep(1000);
    await chatWindow.sendSystemMessage("Please write your plans here in as much detail as you like.")
})();

textInputBox.addEventListener('keydown', async function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (e.key != 'Shift') {
            e.preventDefault();
        }
        let textFromInputBox = textInputBox.value;
        textInputBox.value = "";
        chatWindow.sendUserMessage(textFromInputBox);
    }
});