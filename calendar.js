let fsp = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

console.log("I am working.");

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Creates a new event on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {Object} eventBody The event details.
 */
async function createEvent(auth, eventBody) {
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        const event = await calendar.events.insert({
            calendarId: 'primary',
            resource: eventBody,
        });
        console.log(`Event created: ${event.data.htmlLink}`);
    } catch (error) {
        console.error('Error creating event', error);
    }
}

/**
 * Creates an object literal representing the event details.
 * @param {string} summary The summary of the event.
 * @param {string} location The location of the event.
 * @param {string} description The description of the event.
 * @param {Date} startDateTime The start date and time of the event.
 * @param {Date} endDateTime The end date and time of the event.
 * @returns {Object} The event object literal.
 */

function createEventObject(summary, location, description, startDateTime, endDateTime) {
    return {
        'summary': summary,
        'location': location,
        'description': description,
        'start': {
            'dateTime': startDateTime.toISOString(),
            'timeZone': 'America/Los_Angeles', // Adjust to the desired timezone
        },
        'end': {
            'dateTime': endDateTime.toISOString(),
            'timeZone': 'America/Los_Angeles', // Adjust to the desired timezone
        },
        'reminders': {
            'useDefault': false,
            'overrides': [
                { 'method': 'email', 'minutes': 24 * 60 },
                { 'method': 'popup', 'minutes': 10 },
            ],
        },
    };
}

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fsp.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    try {
        // Read the credentials file
        const content = await fsp.readFile(CREDENTIALS_PATH, 'utf8'); // Ensure encoding is specified to get a string
        const keys = JSON.parse(content);
        const key = keys.installed || keys.web;

        // Prepare the payload
        const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: key.client_id,
            client_secret: key.client_secret,
            refresh_token: client.credentials.refresh_token,
        });

        // Write the updated credentials
        await fsp.writeFile(TOKEN_PATH, payload);
        console.log("Credentials saved successfully.");
    } catch (error) {
        console.error("Failed to save credentials:", error);
    }
}
/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listEvents(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 5,
        singleEvents: true,
        orderBy: 'startTime',
    });
    const events = res.data.items;
    if (!events || events.length === 0) {
        console.log('No upcoming events found.');
        return;
    }
    console.log('Upcoming 10 events:');
    events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${start} - ${event.summary}`);
    });
}

authorize().then(listEvents).catch(console.error);

// Example usage
authorize().then(auth => {

    // Creating an event object
    const newEvent = createEventObject(
        'Team Meeting', // Summary
        'Online', // Location
        'Discuss project progress', // Description
        new Date('2024-05-15T09:00:00'), // Start date and time
        new Date('2024-05-15T10:00:00') // End date and time
    );

    // Creating the event on Google Calendar
    createEvent(auth, newEvent).catch(console.error);

}).catch(console.error);