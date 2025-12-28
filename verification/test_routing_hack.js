const assert = require('assert');

// 1. Simulate 404.html logic (IMPROVED VERSION)
function simulate404Redirect(path, search, hash, repoName) {
    // 404.html logic
    if (path.startsWith(repoName)) {
        let route = path.substring(repoName.length);
        // The proposed fix: include search and hash in the encoded component
        const fullRedirectPath = route + search + hash;
        return repoName + '/?redirect=' + encodeURIComponent(fullRedirectPath);
    }
    return repoName + '/';
}

// 2. Simulate app.js logic (EXISTING LOGIC)
function simulateAppJsRestore(redirectUrl, repoName) {
    // Extract query string from redirectUrl
    // We treat redirectUrl as relative to domain root for this test
    const urlObj = new URL(redirectUrl, 'http://example.com');
    const urlParams = new URLSearchParams(urlObj.search);
    const redirectPath = urlParams.get('redirect');

    if (redirectPath) {
        // app.js logic: simple concatenation
        const BASE_PATH = repoName;
        const newPath = BASE_PATH + redirectPath;
        return newPath;
    }
    return null;
}

// Test cases
const tests = [
    {
        name: 'Simple path',
        path: '/ADHDtools/pomodoro',
        search: '',
        hash: '',
        expected: '/ADHDtools/pomodoro'
    },
    {
        name: 'Path with query',
        path: '/ADHDtools/pomodoro',
        search: '?timer=25',
        hash: '',
        expected: '/ADHDtools/pomodoro?timer=25'
    },
    {
        name: 'Path with hash',
        path: '/ADHDtools/pomodoro',
        search: '',
        hash: '#settings',
        expected: '/ADHDtools/pomodoro#settings'
    },
    {
        name: 'Path with query and hash',
        path: '/ADHDtools/pomodoro',
        search: '?timer=25',
        hash: '#settings',
        expected: '/ADHDtools/pomodoro?timer=25#settings'
    },
    {
        name: 'Deep path',
        path: '/ADHDtools/tools/subtool',
        search: '',
        hash: '',
        expected: '/ADHDtools/tools/subtool'
    },
    {
        name: 'Special characters',
        path: '/ADHDtools/search',
        search: '?q=hello world&lang=en',
        hash: '',
        expected: '/ADHDtools/search?q=hello world&lang=en'
    }
];

const REPO_NAME = '/ADHDtools';

console.log('Running routing hack tests...');

let passed = 0;
tests.forEach(test => {
    try {
        const redirectUrl = simulate404Redirect(test.path, test.search, test.hash, REPO_NAME);
        const restoredPath = simulateAppJsRestore(redirectUrl, REPO_NAME);

        assert.strictEqual(restoredPath, test.expected);
        console.log(`PASS: ${test.name}`);
        passed++;
    } catch (e) {
        console.error(`FAIL: ${test.name}`);
        console.error(`  Expected: ${test.expected}`);
        console.error(`  Actual:   ${e.actual}`);
        console.error(e);
    }
});

if (passed === tests.length) {
    console.log('All tests passed!');
    process.exit(0);
} else {
    console.error(`Failed ${tests.length - passed} tests.`);
    process.exit(1);
}
