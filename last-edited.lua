local months = {
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
}

local function display_date(value)
  local raw = pandoc.utils.stringify(value)
  local year, month, day = raw:match("^(%d%d%d%d)%-(%d%d)%-(%d%d)$")

  if year and month and day then
    local month_number = tonumber(month)
    local day_number = tonumber(day)

    if months[month_number] and day_number then
      return months[month_number] .. " " .. day_number .. ", " .. year
    end
  end

  return raw
end

local function text_inlines(text)
  local inlines = pandoc.List()
  local first = true

  for word in text:gmatch("%S+") do
    if not first then
      inlines:insert(pandoc.Space())
    end
    inlines:insert(pandoc.Str(word))
    first = false
  end

  return inlines
end

function Pandoc(document)
  local last_edited = document.meta["last-edited"]

  if not last_edited then
    return document
  end

  local footer_text = "Last edited: " .. display_date(last_edited)
  local footer = pandoc.Div(
    { pandoc.Para(text_inlines(footer_text)) },
    pandoc.Attr("", { "last-edited" })
  )

  document.blocks:insert(footer)
  return document
end
