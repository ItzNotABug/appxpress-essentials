// noinspection JSUnresolvedReference

import etag from 'etag';
import fresh from 'fresh';
import fs from 'fs/promises';

const configOptions = {
    favIconCache: undefined,
    favIconMaxCacheDays: 365,
    favIconPath: 'public/favicon.ico',
};

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

export default {
    /**
     * Sets options for the favicon middleware.
     *
     * @param {Object} options - Configuration options.
     * @param {string} [options.iconPath='public/favicon.ico'] - Path to the favicon file.
     * @param {number} [options.maxCacheDays=365] - Number of days to cache the favicon.
     */
    options: ({ iconPath = 'public/favicon.ico', maxCacheDays = 365 }) => {
        configOptions.favIconPath = iconPath;
        configOptions.favIconMaxCacheDays = maxCacheDays;
    },

    /**
     * Middleware to serve the favicon.
     *
     * @param {Object} req - The `AppExpressRequest` object.
     * @param {Object} res - The `AppExpressResponse` object.
     */
    middleware: async (req, res) => {
        const isFavIconPath = req.path === '/favicon.ico';
        if (!isFavIconPath) return;

        if (isRequestValid(req, res)) await sendIcon(req, res);
    },
};

/**
 * Validates the request method, allowing only `GET` and `HEAD`.
 *
 * @param {Object} request - The `AppExpressRequest object.
 * @param {Object} response - The `AppExpressResponse` object.
 * @returns {boolean} True if the request method is valid, otherwise false.
 */
const isRequestValid = (request, response) => {
    if (request.method !== 'get' && request.method !== 'head') {
        response.setHeaders({
            'content-length': '0',
            allow: 'GET, HEAD, OPTIONS',
        });

        response.send('', request.method === 'options' ? 200 : 405);
        return false;
    }

    return true;
};

/**
 * Sends the favicon in response to a valid request.
 *
 * The favicon is served from memory (if available) until the function container is removed.
 *
 * @param {Object} request - The `AppExpressRequest` object.
 * @param {Object} response - The `AppExpressResponse` object.
 */
const sendIcon = async (request, response) => {
    const maCacheAge = ONE_DAY_IN_SECONDS * configOptions.favIconMaxCacheDays;
    configOptions.favIconCache =
        configOptions.favIconCache || (await readFaviconFile());

    const responseHeaders = {
        etag: etag(configOptions.favIconCache),
        'cache-control': `public, max-age=${maCacheAge}`,
        'content-length': configOptions.favIconCache.length.toString(),
    };

    if (isFresh(request.headers, responseHeaders)) {
        response.send('', 304);
        return;
    }

    response.setHeaders(responseHeaders);
    response.send(configOptions.favIconCache, 200, 'image/x-icon');
};

/**
 * Evaluates if the provided request is 'fresh' by comparing request and response headers.
 *
 * @param {object} reqHeaders - The headers of the incoming HTTP request.
 * @param {object} resHeaders - The headers prepared for the HTTP response.
 * @returns {boolean} True if the request is considered fresh, false otherwise.
 */
const isFresh = (reqHeaders, resHeaders) => {
    return fresh(reqHeaders, { etag: resHeaders.etag });
};

/**
 * Reads the favicon file from the disk. This function should ideally use the base directory setting configured in Express.
 *
 * @returns {Promise<Buffer>} A promise that resolves with the contents of the favicon file.
 */
const readFaviconFile = async () => {
    return await fs.readFile(`./src/function/${configOptions.favIconPath}`);
};
