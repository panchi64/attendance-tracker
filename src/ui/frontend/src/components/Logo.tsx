function Logo(props: { logoPath: string, universityName: string}) {
  return (
    <div class="p-2 h-48 w-48 mr-8">
      <img src={props.logoPath} alt={props.universityName}/>
    </div>
  )
}

export default Logo;