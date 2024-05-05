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

async function sendMessage() {
    var userMessage = inputBox.value;
    var userStoppedReply = stopReason == null;
    if (userMessage || userStoppedReply) {
        if (!userStoppedReply) {
            let userSpan = document.createElement("span");
            userSpan.className = "chatMessage insideContext";
            let userName = document.createElement("p");
            userName.innerHTML = "User:\n"
            userSpan.appendChild(userName);
            let userParagraph = document.createElement("p");
            userParagraph.innerHTML = marked.parse(userMessage);
            userSpan.appendChild(userParagraph);
            chatHistory.appendChild(userSpan);
            messages.push({ "role": "user", "content": userMessage });
            inputBox.value = '';
            chatHistory.scrollTop = chatHistory.scrollHeight;
            if (selectedChat != 0) {
                let curChat = savedChats.splice(selectedChat, 1)[0];
                if (savedChats[0].name == "New chat") {
                    savedChats.splice(0, 1);
                }
                savedChats = [curChat, ...savedChats];
                selectChat(0);
                updateSavedChatNames();
            }

            let assistantSpan = document.createElement("span");
            assistantSpan.className = "chatMessage insideContext";

            let assistantName = document.createElement("p");
            assistantName.innerHTML = "Assistant:\n";
            assistantSpan.appendChild(assistantName);

            let assistantParagraph = document.createElement("p");
            assistantParagraph.classList.add("assistantMessageContent");
            assistantParagraph.innerHTML = "";
            assistantSpan.appendChild(assistantParagraph);

            chatHistory.appendChild(assistantSpan);
            let listenIcon = document.createElement("i");
            listenIcon.classList.add("fas", "fa-headphones");
            listenIcon.style.float = "right";
            listenIcon.style.marginLeft = "10px";

            listenIcon.style.opacity = 0;

            assistantSpan.addEventListener("mouseleave", function () {
                listenIcon.style.opacity = 0;
            });
            assistantSpan.appendChild(listenIcon)
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;

        var context = [systemMessage, ...messages]

        let oldHistory = document.getElementsByClassName("assistantMessageContent");
        let lastMessage = oldHistory[oldHistory.length - 1];
        let oldAssistantParagraph = lastMessage.innerHTML;
        if (userStoppedReply) {
            context.push({ "role": "system", "content": "Remember, no comments or repetitions. Continue and finish your last message exactly where it ended without any repetition or commentary." });
        }
        let addedHistory = "";
        if (!isStreamingResponse) {
            swapNewAndStopButton();
        }

        const stream = await openai.chat.completions.create({
            'model': model.toLowerCase(),
            'messages': context,
            'stream': true,
        });

        for await (const part of stream) {
            if (!isStreamingResponse) {
                break;
            }
            addedHistory += part.choices[0]?.delta?.content || '';
            lastMessage.innerHTML = marked.parse(oldAssistantParagraph + addedHistory);
            if (isScrolledToBottom(chatHistory)) {
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }
            stopReason = part.choices[0].finish_reason;
        }

        if (isScrolledToBottom(chatHistory)) {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }

        if (isStreamingResponse) {
            swapNewAndStopButton();
        }

        if (messages[messages.length - 1].role != "assistant") {
            messages.push({ "role": "assistant", "content": addedHistory });
        } else {
            messages[messages.length - 1].content += addedHistory;
        }

        if (selectedChat == 0 & allSavedChats[0].children[0].innerHTML === "New chat") {
            allSavedChats[0].children[0].innerHTML = "";
            const stream = await openai.chat.completions.create({
                'model': "gpt-3.5-turbo-1106",
                'messages': [{
                    "role": "user", "content": `Instruction: Name the chat from the last message (with either 1 or 2 emojis)\n
Example chat: "how to make pink cake"\n
Example title: 🎂 Pink Cake Recipe\n
Chat: "${userMessage}"\n
Title:`,
                }],
                'max_tokens': 15,
                'stream': true,
            });
            for await (const part of stream) {
                allSavedChats[0].children[0].innerHTML += part.choices[0]?.delta?.content || '';
            }
            savedChats[0].name = allSavedChats[0].children[0].innerHTML;
        }

        savedChats[selectedChat] = { "name": savedChats[0].name, "messages": messages };
        fs.writeFileSync("saved-chats.json", JSON.stringify(savedChats));

        let assistantSpans = document.getElementsByClassName("chatMessage insideContext");
        let assistantSpan = assistantSpans[assistantSpans.length - 1];
        let allListenIcons = document.getElementsByTagName("i");
        let lastListenIcon = allListenIcons[allListenIcons.length - 1];
        lastListenIcon.addEventListener("click", function () {
            readAloud(lastMessage.innerText);
        });
        assistantSpan.addEventListener("mouseover", function () {
            lastListenIcon.style.opacity = 1;
        });
    }
};