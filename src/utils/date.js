function formatDate(
  date = new Date()
) {

  return date.toLocaleString(
    'ja-JP',
    {
      timeZone:
        'Asia/Tokyo',

      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',

      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }
  );
}

module.exports = {
  formatDate
};
