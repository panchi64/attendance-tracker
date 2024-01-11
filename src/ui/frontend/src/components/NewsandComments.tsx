function NewsandComments(props: {textContent?: string}) {
    return(
        <div class="w-full h-full grid-rows-8 text-black p-8">
            <div class="row-span-1 row-start-1 text-2xl m-2  max-w-3xl">
                News / Comments
                <div class="divider my-2"></div>
            </div>
            <textarea class="bg-transparent px-4 pt-1 pb-4 w-full max-w-3xl border-0 text-4xl text-center" placeholder="Today's notes...">{props.textContent}</textarea>
        </div>
    );
}

export default NewsandComments;