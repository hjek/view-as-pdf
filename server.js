// view-as-pdf
// Copyright (c) 2020 Pelle Hjek
// Affero GPL version 3

const puppeteer = require('puppeteer')
const http = require('http')
const url = require('url')
const fs = require('fs')

// load configuration
const config = JSON.parse(fs.readFileSync('config.json'))
const port = config.port || 8080
const hosts = config.hosts || ["docs.google.com"]
const timeout = Number(config.timeout) || 30000

const form =
`<!DOCTYPE html>
<html>
  <head>
    <title>view as pdf</title>
  </head>
  <body>
    <form target="_blank">
      <input name="url" type="url" required="required" placeholder="https://docs.google.com/whatever"></input>
      <input type="submit" value="view as pdf"></input>
    </form>
  </body>
</html>`

const urlToPdf = async (my_url) => {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    config.timeout || page.setDefaultTimeout(config.timeout)
    await page.goto(my_url)
    await isLoaded(my_url, page)
    const buffer = await page.pdf({format: 'A4', waitUntil: 'networkidle2'})
    await browser.close()
    return buffer
}

const isLoaded = async (my_url, page) => {
    // check if page is done loading. requires app specific quirks.
    if (my_url.host === 'docs.google.com') {
    // google docs
	await page.waitForSelector('.docs-gm')
	return true
    }
    if (my_url.href.match(/\/onlyoffice\//)) {
    // onlyoffice
	await page.waitForSelector('.app-onlyoffice')
	return true
    }
    if (my_url.href.match(/\/pad\//)) {
    // cryptpad
	await page.waitForSelector('.app-pad')
	return true
    }
    return true
}

const isAllowed = (my_url) => {
    return hosts.includes(my_url.host)
}

http.createServer(async (req, res) => {
    const queryObject = url.parse(req.url,true).query
    try {
	const my_url = new URL(queryObject.url)
	if (isAllowed(my_url)) {
	    await urlToPdf(my_url).then(
		buffer => {
		    res.writeHead(200)
		    res.write(buffer, 'binary')
		    res.end(null, 'binary')
		}).catch( 
		    error => {
			res.writeHead(500, {'Content-Type': 'text/plain'})
			res.write("sorry, failed to create pdf:\n\n" + error)
			res.end(null)
		    })
	} else {
	    res.writeHead(403, {'Content-Type': 'text/plain'})
	    res.write('sorry, ' + my_url.host + ' not allowed')
	    res.end(null)
	}
    } catch(e) {
	// without valid url parameter given, just show input form
	res.writeHead(200, {'Content-Type': 'text/html'})
	res.write(form)
	res.end(null)
    }
}).listen(port)

console.log('serving on :' + (port))
