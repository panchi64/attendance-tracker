# 🚧 Automated Attendance Tracker - WIP 🚧

This project is an automated attendance tracker designed to streamline the process of attendance recording for
professors, built using [Rust](https://www.rust-lang.org/).

## Features

- [ ] **Web Server Integration**: The tracker creates a **_locally accessible_** web server, so students cannot mark
  attendance if they are not physically present in class.
- [ ] **Export to CSV**: Attendance records can be exported to a `.csv` file for easy analysis and record-keeping.
- [ ] **Online Platform Support**: Seamlessly integrates with online platforms (_Moodle_), allowing for direct upload of
  attendance data.
- [ ] **Customize once**: All customizations and edits you make will be saved and used the next time you launch the
  application. No need to worry about spending time setting it up again. There are even options to save the current
  customization as a course to-be-switched-to later!
- [ ] **Multiple Course Support**: Some professors give more than a single course, that's handled as well. Just switch to
  the course you're currently giving!

## Usage

1. Download the application for your operating system (Windows, Mac, Linux, etc.) from
   the [releases page](https://github.com/panchi64/attendance-tracker/releases)
2. Double-click or launch the downloaded application.
3. Wait for the server to initialize and the webpage to pop-up.
4. Customize the images, course name, professor's name, section number, etc...
5. Display the webpage to the whole class, so they can mark attendance.
6. Enjoy!

## Development

### Manual Installation

1. Make sure you have Rust installed. If not download it from [here](https://www.rust-lang.org/)
2. Clone the repository: `git clone https://github.com/panchi64/attendance-tracker`
3. Navigate to the project directory: `cd attendance-tracker`
4. If you'd like to see the application running: `cargo run --release`

## Contributing

Contributions to the project are welcome! Please follow these steps:

1. Create an issue with your request titled `[REQUEST] <feature-name>` and a description of why that feature should be
   added.
2. Fork the repository.
3. Create a new branch: `git checkout -b <feature-name>`
4. Make your changes and commit them `git commit -m 'Added <feature-name>'`
5. Push to your branch: `git push origin <feature-name>`
6. Submit a pull request with that branch to this project! _For more details read
   the [documentation on GitHub](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)_

## License

This project is licensed under the MIT License - see the `LICENSE.md` file for details.

## Acknowledgments

- Special thanks to my Thermodynamics professor for this idea back in 2021 or 2022 (I don't remember 😅).

---

For more information or to report issues, please visit the project's [GitHub Issues](https://github.com/panchi64/attendance-tracker/issues) or [Wiki](https://github.com/panchi64/attendance-tracker/wiki) pages.
