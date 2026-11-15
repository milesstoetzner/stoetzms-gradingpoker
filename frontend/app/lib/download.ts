// Lets the browser download the text as a file, e.g., type "data:text/yaml;charset=utf-8,"
export function download(name: string, type: string, data: string) {
    const link = document.createElement('a')
    link.setAttribute('href', type + encodeURIComponent(data))
    link.setAttribute('download', name)
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}
