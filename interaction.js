console.log("Hello world!")

let textInputBox = document.getElementById('text-input-box')
let chatHistory = document.getElementById('chat-history')

textInputBox.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        let textFromInputBox = textInputBox.value;
        textInputBox.value = "";
        let newParagraph = document.createElement('p');
        newParagraph.innerHTML = textFromInputBox;
        chatHistory.appendChild(newParagraph);
        chatHistory.scrollTo({ top: chatHistory.scrollHeight })
    } else {
        console.log('the ship ain\'t shippin\'');
    }
});